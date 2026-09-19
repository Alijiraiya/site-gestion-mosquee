import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import {
  SVF_DEFAULTS,
  getEffectiveSvfWeights,
  sanitizeSvfWeights,
} from "@/lib/svf";
import { WF_DEFAULTS } from "@/lib/waterFilling";
import { recalcMosqueFamilies } from "@/lib/recalc";
import { INT32_MAX, numberField } from "@/lib/validate";

async function ensureSettings(mosqueId) {
  let s = await prisma.mosqueSettings.findUnique({ where: { mosqueId } });
  if (!s) s = await prisma.mosqueSettings.create({ data: { mosqueId } });
  return s;
}

// Boolean columns on MosqueSettings.
const BOOL_FIELDS = ["autoCalculateSVF", "allowAnonymousDonations"];

// Integer point/threshold columns on MosqueSettings. These are the fields the
// Settings UI renders, and they were previously silently dropped because the
// PUT allow-list only contained four keys (one of which, `currency`, does not
// even exist on the model and made every save throw).
const INT_FIELDS = [
  "svfMaxScore",
  "pointsIfIncomeBelowSMIG",
  "pointsIfIncomeBelow2xSMIG",
  "pointsIfIncomeBelow3xSMIG",
  "pointsPerChild",
  "childPointsCap",
  "pointsIfWidowedDivorced",
  "pointsIfNoSupport",
  "pointsIfDisability",
  "pointsIfChronicIllness",
  "pointsIfTenant",
  "malusPerAidReceived",
  "malusCap",
  "seniorAgeThreshold",
  "pointsIfSeniorHead",
  "youngHeadAgeThreshold",
  "pointsIfYoungHead",
];

// Decimal / float columns on MosqueSettings.
const NUMBER_FIELDS = [
  "smigThreshold",
  "povertyThresholdPerPerson",
  "svfWeightExponent",
  "minimumDistributionAmount",
  "reservePercentage",
];

// Sensible per-field ceilings. Postgres INTEGER stops at 2147483647, so 1e12
// used to reach the driver and come back as an empty HTTP 500 -- 17 different
// ways to crash the settings page. Age thresholds get a human ceiling on top:
// a "senior from 500 years old" threshold is a typo, not a configuration.
const AGE_FIELDS = new Set(["seniorAgeThreshold", "youngHeadAgeThreshold"]);
const AGE_MAX = 130;

// Points are bounded by the score scale itself: nothing above 100 can mean
// anything once computeSVF() clamps the total to [0, 100].
const POINT_MAX = 100000;

// Map the granular MosqueSettings point columns onto the flat SVF weight keys
// used by computeSVF(), so editing the Settings UI actually changes scoring.
const COLUMN_TO_WEIGHT = {
  smigThreshold: "svf_smig",
  pointsIfIncomeBelowSMIG: "svf_pts_income_t1",
  pointsIfIncomeBelow2xSMIG: "svf_pts_income_t2",
  pointsIfIncomeBelow3xSMIG: "svf_pts_income_t3",
  pointsPerChild: "svf_pts_per_child",
  childPointsCap: "svf_max_children_pts",
  pointsIfWidowedDivorced: "svf_pts_social_widow_divorced",
  pointsIfNoSupport: "svf_pts_social_no_support",
  pointsIfDisability: "svf_pts_health_disability",
  pointsIfChronicIllness: "svf_pts_health_chronic",
  pointsIfTenant: "svf_pts_renting",
  malusPerAidReceived: "svf_malus_per_benefit",
  malusCap: "svf_max_malus",
  seniorAgeThreshold: "svf_age_senior_threshold",
  pointsIfSeniorHead: "svf_pts_age_senior",
  youngHeadAgeThreshold: "svf_age_young_threshold",
  pointsIfYoungHead: "svf_pts_age_young",
};

function weightsFromColumns(settings) {
  const out = {};
  for (const [column, weightKey] of Object.entries(COLUMN_TO_WEIGHT)) {
    const v = settings?.[column];
    if (v !== null && v !== undefined && isFinite(Number(v))) {
      out[weightKey] = Number(v);
    }
  }
  return out;
}

// Effective weights = code defaults < persisted point columns < svfWeights JSON.
function effectiveWeightsFor(settings) {
  return getEffectiveSvfWeights({
    ...weightsFromColumns(settings),
    ...(settings?.svfWeights && typeof settings.svfWeights === "object"
      ? settings.svfWeights
      : {}),
  });
}

// GET /api/settings -- current settings + effective SVF weights + WF defaults.
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const settings = await ensureSettings(mosque.id);

  return ok({
    settings,
    svfWeights: effectiveWeightsFor(settings),
    svfDefaults: SVF_DEFAULTS,
    // true when custom weights are stored for this mosque.
    svfCustomized:
      settings.svfWeights !== null && settings.svfWeights !== undefined,
    waterFilling: WF_DEFAULTS,
  });
}

// PUT /api/settings -- update settings (incl. custom SVF weights), then
// recalculate every family's SVF score with the effective weights.
export async function PUT(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  const current = await ensureSettings(mosque.id);

  const data = {};

  for (const f of BOOL_FIELDS) {
    if (body[f] !== undefined) data[f] = Boolean(body[f]);
  }

  for (const f of INT_FIELDS) {
    if (body[f] === undefined) continue;
    const max = AGE_FIELDS.has(f) ? AGE_MAX : POINT_MAX;
    const [value, msg] = numberField(body[f], f, { min: 0, max, integer: true });
    if (msg) return fail(msg);
    data[f] = value;
  }

  for (const f of NUMBER_FIELDS) {
    if (body[f] === undefined) continue;
    const [value, msg] = numberField(body[f], f, { min: 0 });
    if (msg) return fail(msg);
    data[f] = value;
  }

  // svfWeightExponent drives Math.pow() inside the water-filling allocation.
  // A value of 1e12 turned every share into Infinity and the whole simulation
  // into NaN, which then propagated into real payment amounts.
  if (data.svfWeightExponent !== undefined && data.svfWeightExponent > 10) {
    return fail("svfWeightExponent cannot exceed 10.");
  }

  // Two money columns share the Decimal(14,2) limit of the schema.
  for (const f of ["smigThreshold", "minimumDistributionAmount"]) {
    if (data[f] !== undefined && data[f] > INT32_MAX) {
      return fail(`${f} is too large.`);
    }
  }

  // reservePercentage is a fraction of the budget. Accept either 0.1 or 10 from
  // the UI, but always persist the fraction so waterFilling and the UI agree.
  if (data.reservePercentage !== undefined) {
    if (data.reservePercentage > 100)
      return fail("reservePercentage cannot exceed 100.");
    if (data.reservePercentage > 1)
      data.reservePercentage = data.reservePercentage / 100;
    if (data.reservePercentage >= 1)
      return fail("reservePercentage must be below 100%.");
  }

  if (body.customCriteria !== undefined) {
    if (!Array.isArray(body.customCriteria))
      return fail("customCriteria must be an array.");
    data.customCriteria = body.customCriteria;
  }

  // Custom SVF weights: merge new numeric keys over any existing overrides.
  // Pass svfWeights: null to clear overrides and fall back to defaults.
  if (body.svfWeights !== undefined) {
    if (body.svfWeights === null) {
      data.svfWeights = null;
    } else {
      if (typeof body.svfWeights !== "object" || Array.isArray(body.svfWeights))
        return fail("svfWeights must be an object or null.");
      const existing =
        current.svfWeights && typeof current.svfWeights === "object"
          ? current.svfWeights
          : {};
      data.svfWeights = { ...existing, ...sanitizeSvfWeights(body.svfWeights) };
    }
  }

  if (Object.keys(data).length === 0) {
    return fail("No recognised settings field was provided.");
  }

  const settings = await prisma.mosqueSettings.update({
    where: { mosqueId: mosque.id },
    data,
  });

  // Recalculate SVF for all families of this mosque using the new weights --
  // but only when "Calcul automatique du SVF" is on (the value just saved,
  // if this request touched it). When it's off, weight edits are stored for
  // next time but don't cascade into a bulk rescoring of every family.
  //
  // This is the widest synchronisation point in the app: changing one point
  // value here must move EVERY family at once, otherwise two families would
  // be compared with two different rulesets in the next simulation.
  const weights = effectiveWeightsFor(settings);
  const recalculated = settings.autoCalculateSVF
    ? await recalcMosqueFamilies(mosque.id, weights)
    : 0;

  return ok({
    settings,
    svfWeights: weights,
    svfCustomized:
      settings.svfWeights !== null && settings.svfWeights !== undefined,
    recalculatedFamilies: recalculated,
    // Explicit so the UI can warn "scores were NOT refreshed" instead of
    // silently showing 0.
    svfAutoCalcDisabled: !settings.autoCalculateSVF,
  });
}
