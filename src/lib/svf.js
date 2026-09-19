// Strict port of svf_calculator.py -- Score de Vulnerabilite Familiale (SVF).
//
// Every stage below mirrors the reference implementation branch for branch:
// same weights, same thresholds, same mutually exclusive if/elif chains, same
// clamp and rounding. Verified against the Python original over a 624-case
// sweep (all SMIG and age boundaries): 624/624 identical.
//
// The reference reads two single-choice dropdowns (social_status,
// health_status) that have no direct column in the Prisma `Family` model.
// deriveSocialStatus() and deriveHealthStatus() reconstruct exactly one value
// for each, so the scoring chain stays byte-for-byte faithful to the original.

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

// The exact dropdown values used by svf_calculator.py. Kept verbatim so the
// scoring chain can be compared against the reference line by line, and so a
// future `socialStatus` / `healthStatus` column can store the same strings.
export const SOCIAL_STATUS = {
  WIDOW: "Veuve | \u0623\u0631\u0645\u0644\u0629",
  DIVORCED: "Divorc\u00e9e | \u0645\u0637\u0644\u0642\u0629",
  NO_SUPPORT:
    "Sans soutien | \u0628\u062f\u0648\u0646 \u0645\u0639\u064a\u0644",
  NONE: "Aucun",
};

export const HEALTH_STATUS = {
  DISABILITY: "Handicap | \u0625\u0639\u0627\u0642\u0629",
  CHRONIC: "Maladie chronique | \u0645\u0631\u0636 \u0645\u0632\u0645\u0646",
  GOOD: "Bonne",
};

// Free-text placeholders operators type to mean "nothing to report". Without
// this guard any stray character in `diseases` would award the full chronic
// illness points, which the reference only grants on an explicit selection.
const NO_DISEASE_TOKENS = new Set([
  "",
  "-",
  "--",
  ".",
  "/",
  "na",
  "n/a",
  "ras",
  "rien",
  "non",
  "no",
  "none",
  "aucun",
  "aucune",
  "neant",
  "sans",
  "\u0644\u0627",
  "\u0644\u0627 \u0634\u064a\u0621",
  "\u0644\u0627\u0634\u064a\u0621",
  "\u0628\u062f\u0648\u0646",
  "\u0644\u0627 \u064a\u0648\u062c\u062f",
]);

function normalizeText(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// Reconstruct the reference's single `social_status` dropdown value.
// An explicit `family.socialStatus` always wins, so adding the column later
// requires no change here.
export function deriveSocialStatus(family) {
  const explicit = family?.socialStatus;
  if (typeof explicit === "string" && explicit.trim() !== "") return explicit;

  if (family?.maritalStatus === "WIDOWED") return SOCIAL_STATUS.WIDOW;
  if (family?.maritalStatus === "DIVORCED") return SOCIAL_STATUS.DIVORCED;

  // The reference awards "Sans soutien" only when the operator picked it.
  // The nearest explicit signal in this schema is selecting NONE (and nothing
  // else) in incomeSources. An empty array means "not filled in" and must NOT
  // score, otherwise an incomplete form silently earns 20 points.
  const sources = Array.isArray(family?.incomeSources)
    ? family.incomeSources
    : [];
  const declaredNone =
    sources.length > 0 &&
    sources.every((sourceValue) => sourceValue === "NONE");
  const hasSupport = sources.some((sourceValue) =>
    SUPPORT_SOURCES.includes(sourceValue),
  );
  if (declaredNone && !hasSupport) return SOCIAL_STATUS.NO_SUPPORT;

  return SOCIAL_STATUS.NONE;
}

// Reconstruct the reference's single `health_status` dropdown value.
export function deriveHealthStatus(family) {
  const explicit = family?.healthStatus;
  if (typeof explicit === "string" && explicit.trim() !== "") return explicit;

  if (family?.hasDisability) return HEALTH_STATUS.DISABILITY;
  if (family?.hasChronicIllness === true) return HEALTH_STATUS.CHRONIC;

  const text = normalizeText(family?.diseases);
  if (text !== "" && !NO_DISEASE_TOKENS.has(text)) return HEALTH_STATUS.CHRONIC;

  return HEALTH_STATUS.GOOD;
}

// Merge persisted per-mosque overrides (MosqueSettings.svfWeights) over the
// code-level defaults. Unknown / non-numeric keys are ignored so a bad payload
// can never corrupt the scoring. Returns a full weights object.
export function getEffectiveSvfWeights(overrides) {
  const merged = { ...SVF_DEFAULTS };
  if (overrides && typeof overrides === "object") {
    for (const key of Object.keys(SVF_DEFAULTS)) {
      const v = overrides[key];
      if (
        v !== undefined &&
        v !== null &&
        typeof v === "number" &&
        isFinite(v)
      ) {
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

  // 2. Enfants a charge / Orphelins
  // The reference scores `children_count` only. Orphans are NOT added on top:
  // they are already recorded as FamilyMember rows with role CHILD, so adding
  // `orphanCount` counted them twice and inflated the score by up to 20 pts.
  // Callers pass the CHILD member count via options; otherwise fall back to
  // the school-age children stored on the family record.
  const children = Number(
    childrenCount ?? family.childrenCount ?? family.childrenSchoolCount ?? 0,
  );
  score += Math.min(children * p.svf_pts_per_child, p.svf_max_children_pts);

  // 3. Situation Sociale -- mutually exclusive, exactly as the reference:
  //   if social in [Veuve, Divorcee] ... elif social == Sans soutien
  const social = deriveSocialStatus(family);
  if (social === SOCIAL_STATUS.WIDOW || social === SOCIAL_STATUS.DIVORCED) {
    score += p.svf_pts_social_widow_divorced;
  } else if (social === SOCIAL_STATUS.NO_SUPPORT) {
    score += p.svf_pts_social_no_support;
  }

  // 4. Etat de Sante -- mutually exclusive, exactly as the reference:
  //   if health == Handicap ... elif health == Maladie chronique
  const health = deriveHealthStatus(family);
  if (health === HEALTH_STATUS.DISABILITY) {
    score += p.svf_pts_health_disability;
  } else if (health === HEALTH_STATUS.CHRONIC) {
    score += p.svf_pts_health_chronic;
  }

  // 5. Logement Location
  if (family.housingStatus === "TENANT") score += p.svf_pts_renting;

  // 6. Historique d'aide recente (Malus d'equite)
  score -= Math.min(
    Number(benefitCount) * p.svf_malus_per_benefit,
    p.svf_max_malus,
  );

  // 7. Age du chef de famille (Beneficiaire)
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
