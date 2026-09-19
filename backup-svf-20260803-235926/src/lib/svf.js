// Ported from svf_calculator.py -- Score de Vulnerabilite Familiale (SVF).
// Weights are code-level defaults: the current MosqueSettings schema does not
// persist per-mosque SVF weights. Field names are mapped to the Prisma
// `Family` model.

export const SVF_DEFAULTS = {
  svf_smig: 20000,
  svf_pts_income_t1: 40, // income < SMIG
  svf_pts_income_t2: 25, // income < 2x SMIG
  svf_pts_income_t3: 10, // income < 3x SMIG
  svf_pts_per_child: 5,
  svf_max_children_pts: 20,
  svf_pts_social_widow_divorced: 15,
  svf_pts_social_no_support: 20,
  svf_pts_health_disability: 15,
  svf_pts_health_chronic: 10,
  svf_pts_renting: 10,
  svf_malus_per_benefit: 8,
  svf_max_malus: 25,
  svf_age_senior_threshold: 65,
  svf_pts_age_senior: 10,
  svf_age_young_threshold: 25,
  svf_pts_age_young: 5,
};

const SUPPORT_SOURCES = [
  "SALARY",
  "PENSION",
  "FAMILY_SUPPORT",
  "SMALL_BUSINESS",
  "SOCIAL_AID",
  "CHARITY",
];

// Merge persisted per-mosque overrides (MosqueSettings.svfWeights) over the
// code-level defaults. Unknown / non-numeric keys are ignored so a bad payload
// can never corrupt the scoring. Returns a full weights object.
export function getEffectiveSvfWeights(overrides) {
  const merged = { ...SVF_DEFAULTS };
  if (overrides && typeof overrides === "object") {
    for (const key of Object.keys(SVF_DEFAULTS)) {
      const v = overrides[key];
      if (v !== undefined && v !== null && typeof v === "number" && isFinite(v)) {
        merged[key] = v;
      }
    }
  }
  return merged;
}

// Keep only the recognised numeric SVF weight keys from an arbitrary payload,
// so we never persist junk into MosqueSettings.svfWeights.
export function sanitizeSvfWeights(input) {
  if (!input || typeof input !== "object") return {};
  const out = {};
  for (const key of Object.keys(SVF_DEFAULTS)) {
    const v = input[key];
    if (v !== undefined && v !== null && isFinite(Number(v))) {
      out[key] = Number(v);
    }
  }
  return out;
}

export function ageFromDateOfBirth(dob) {
  if (!dob) return 0;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)));
}

// family: a Prisma Family object. options.benefitCount: number of past aids.
export function computeSVF(
  family,
  { benefitCount = 0, weights = SVF_DEFAULTS, childrenCount = undefined } = {},
) {
  const p = weights;
  let score = 0;

  const income = Number(family.monthlyIncome ?? 0);
  const age = ageFromDateOfBirth(family.dateOfBirth);
  const smig = p.svf_smig;

  // 1. Monthly income
  if (income < smig) score += p.svf_pts_income_t1;
  else if (income < 2 * smig) score += p.svf_pts_income_t2;
  else if (income < 3 * smig) score += p.svf_pts_income_t3;

  // 2. Dependent children / orphans
  // `childrenCount` no longer exists on Family. Callers may pass an explicit
  // count (e.g. number of FamilyMember rows with role CHILD) via options;
  // otherwise we fall back to school-age children recorded on the family.
  const childCount = Number(
    childrenCount ?? family.childrenCount ?? family.childrenSchoolCount ?? 0,
  );
  const children = childCount + Number(family.orphanCount ?? 0);
  score += Math.min(children * p.svf_pts_per_child, p.svf_max_children_pts);

  // 3. Social situation
  if (
    family.maritalStatus === "WIDOWED" ||
    family.maritalStatus === "DIVORCED"
  ) {
    score += p.svf_pts_social_widow_divorced;
  } else {
    const sources = Array.isArray(family.incomeSources)
      ? family.incomeSources
      : [];
    const hasSupport = sources.some((s) => SUPPORT_SOURCES.includes(s));
    if (!hasSupport) score += p.svf_pts_social_no_support;
  }

  // 4. Health
  if (family.hasDisability) score += p.svf_pts_health_disability;
  else if (String(family.diseases ?? "").trim() !== "")
    score += p.svf_pts_health_chronic;

  // 5. Renting
  if (family.housingStatus === "TENANT") score += p.svf_pts_renting;

  // 6. Equity malus for recent aid received
  score -= Math.min(
    Number(benefitCount) * p.svf_malus_per_benefit,
    p.svf_max_malus,
  );

  // 7. Head-of-family age
  if (age >= p.svf_age_senior_threshold) score += p.svf_pts_age_senior;
  else if (age > 0 && age < p.svf_age_young_threshold)
    score += p.svf_pts_age_young;

  return Math.round(Math.min(Math.max(score, 0), 100) * 100) / 100;
}

// Map the numeric SVF score to the Prisma PriorityLevel enum.
export function priorityFromScore(score) {
  if (score >= 70) return "URGENT";
  if (score >= 45) return "VULNERABLE";
  if (score >= 20) return "MODERATE";
  return "LOW";
}

// Mapping from MosqueSettings point columns to SVF weight keys.
// Lives here so /api/settings and src/lib/recalc.js share one definition and
// cannot drift apart.
export const COLUMN_TO_WEIGHT = {
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

// Inverse mapping, used to reset the columns back to code defaults.
export const WEIGHT_TO_COLUMN = Object.fromEntries(
  Object.entries(COLUMN_TO_WEIGHT).map(([col, key]) => [key, col]),
);

// Build a partial weights object from persisted MosqueSettings columns.
export function weightsFromColumns(settings) {
  const out = {};
  if (!settings) return out;
  for (const [column, weightKey] of Object.entries(COLUMN_TO_WEIGHT)) {
    const v = settings[column];
    if (v !== null && v !== undefined && isFinite(Number(v))) {
      out[weightKey] = Number(v);
    }
  }
  return out;
}

// The column values that correspond to the code-level SVF defaults.
export function defaultSettingsColumns() {
  const out = {};
  for (const [column, weightKey] of Object.entries(COLUMN_TO_WEIGHT)) {
    if (SVF_DEFAULTS[weightKey] !== undefined) {
      out[column] = SVF_DEFAULTS[weightKey];
    }
  }
  return out;
}
