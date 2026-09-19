import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { WF_DEFAULTS } from "@/lib/waterFilling";
import {
  SVF_DEFAULTS,
  getEffectiveSvfWeights,
  defaultSettingsColumns,
} from "@/lib/svf";
import { recalcMosqueFamilies } from "@/lib/recalc";

// POST /api/settings/reset -- restore defaults.
// Body: { scope: "svf" | "water-filling" | "all" }  (default "all")
//
// - "svf": clears the per-mosque SVF weight overrides so scoring falls back to
//   SVF_DEFAULTS, then recalculates every family's score/priority.
// - "water-filling": resets reservePercentage + minimumDistributionAmount to
//   the code-level Water-Filling defaults.
// - "all": both of the above.
export async function POST(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  const scope = body.scope || "all";
  if (!["svf", "water-filling", "all"].includes(scope)) {
    return fail('scope must be "svf", "water-filling" or "all".');
  }

  const doSvf = scope === "svf" || scope === "all";
  const doWf = scope === "water-filling" || scope === "all";

  const messages = [];
  let recalculatedFamilies = 0;

  // Build the update payload for MosqueSettings in a single upsert.
  const update = {};
  const create = { mosqueId: mosque.id };

  if (doWf) {
    update.reservePercentage = WF_DEFAULTS.wf_reserve;
    update.minimumDistributionAmount = WF_DEFAULTS.wf_min_amt;
    create.reservePercentage = WF_DEFAULTS.wf_reserve;
    create.minimumDistributionAmount = WF_DEFAULTS.wf_min_amt;
    messages.push("Water-Filling parameters reset to defaults.");
  }

  if (doSvf) {
    // Clear the persisted JSON overrides -> scoring reverts to SVF_DEFAULTS.
    update.svfWeights = null;
    create.svfWeights = null;
    // ...and restore the individual point COLUMNS too. Nulling svfWeights
    // alone left values edited through Settings (pointsPerChild, malusCap,
    // smigThreshold, ...) untouched, so "reset to defaults" silently kept the
    // customised scoring.
    const columnDefaults = defaultSettingsColumns();
    Object.assign(update, columnDefaults);
    Object.assign(create, columnDefaults);
    update.svfMaxScore = 100;
    update.autoCalculateSVF = true;
    update.povertyThresholdPerPerson = 20000;
    update.svfWeightExponent = 1.5;
    update.customCriteria = [];
    Object.assign(create, {
      svfMaxScore: 100,
      autoCalculateSVF: true,
      povertyThresholdPerPerson: 20000,
      svfWeightExponent: 1.5,
      customCriteria: [],
    });
    messages.push("SVF parameters reset to defaults.");
  }

  await prisma.mosqueSettings.upsert({
    where: { mosqueId: mosque.id },
    update,
    create,
  });

  // After clearing SVF overrides, recompute scores with the default weights.
  if (doSvf) {
    recalculatedFamilies = await recalcMosqueFamilies(
      mosque.id,
      getEffectiveSvfWeights(null),
    );
    messages.push(`Recalculated ${recalculatedFamilies} family score(s).`);
  }

  return ok({
    scope,
    svfWeights: SVF_DEFAULTS,
    recalculatedFamilies,
    message: messages.join(" "),
  });
}

