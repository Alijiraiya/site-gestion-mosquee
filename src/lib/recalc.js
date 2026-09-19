import { prisma } from "@/lib/prisma";
import {
  computeSVF,
  priorityFromScore,
  getEffectiveSvfWeights,
  COLUMN_TO_WEIGHT,
  weightsFromColumns,
} from "@/lib/svf";
import { countAidBenefits, countAidBenefitsMany } from "@/lib/aidHistory";

// Recompute svfScore + priority for every family linked to a mosque, using the
// mosque's effective SVF weights (persisted overrides merged over defaults) and
// counting each family's CHILD members from the FamilyMember table.
//
// Returns the number of families recalculated.
export async function recalcMosqueFamilies(mosqueId, weightsOverride) {
  const weights = weightsOverride ?? (await loadEffectiveWeights(mosqueId));

  const families = await prisma.family.findMany({
    where: { mosqueFamilies: { some: { mosqueId } } },
    include: {
      _count: { select: { members: { where: { role: "CHILD" } } } },
    },
  });
  if (families.length === 0) return 0;

  const familyIds = families.map((f) => f.id);

  // One aggregate query instead of one COUNT per family (was an N+1 that made
  // PUT /api/settings and /api/settings/reset scale linearly with family
  // count). CANCELLED lines are excluded -- see src/lib/aidHistory.js.
  const benefitMap = await countAidBenefitsMany(familyIds);

  let recalculated = 0;
  const updates = [];
  for (const fam of families) {
    const score = computeSVF(fam, {
      benefitCount: benefitMap[fam.id] ?? 0,
      weights,
      childrenCount: fam._count?.members ?? 0,
    });
    // Skip no-op writes so a recalculation on an unchanged config is cheap.
    if (fam.svfScore === score && fam.priority === priorityFromScore(score)) {
      continue;
    }
    updates.push(
      prisma.family.update({
        where: { id: fam.id },
        data: { svfScore: score, priority: priorityFromScore(score) },
      }),
    );
    recalculated++;
  }

  if (updates.length) await prisma.$transaction(updates);
  return recalculated;
}

// Recompute ONE family's score. Call this after any change that affects the
// inputs of computeSVF -- in particular adding, editing or removing a member,
// since the CHILD count feeds the score, and every distribution event, since
// the aid count feeds the fairness malus.
//
// Returns the new score, or null if the family is not linked to the mosque.
export async function recalcFamily(mosqueId, familyId, weightsOverride) {
  if (!mosqueId || !familyId) return null;

  const fam = await prisma.family.findFirst({
    where: { id: familyId, mosqueFamilies: { some: { mosqueId } } },
    include: {
      _count: { select: { members: { where: { role: "CHILD" } } } },
    },
  });
  if (!fam) return null;

  const weights = weightsOverride ?? (await loadEffectiveWeights(mosqueId));
  const benefitCount = await countAidBenefits(familyId);

  const score = computeSVF(fam, {
    benefitCount,
    weights,
    childrenCount: fam._count?.members ?? 0,
  });
  const priority = priorityFromScore(score);

  if (fam.svfScore === score && fam.priority === priority) return score;

  await prisma.family.update({
    where: { id: familyId },
    data: { svfScore: score, priority },
  });
  return score;
}

/**
 * Recompute a SPECIFIC LIST of families in one pass.
 *
 * This is what the distribution routes call: confirming, paying, cancelling or
 * deleting a distribution changes the aid count of every family on the list,
 * and each of those families must be rescored. Doing it one by one would
 * re-read the weights and re-open a transaction per family.
 *
 * Honours the "Calcul automatique du SVF" setting, like every other automatic
 * rescoring path.
 *
 * @returns {Promise<{ recalculated: number, scores: Record<string, number>, skipped: boolean }>}
 */
export async function recalcFamilies(mosqueId, familyIds) {
  const ids = [...new Set((familyIds ?? []).filter(Boolean))];
  if (!mosqueId || ids.length === 0) {
    return { recalculated: 0, scores: {}, skipped: false };
  }

  if (!(await isAutoCalcEnabled(mosqueId))) {
    return { recalculated: 0, scores: {}, skipped: true };
  }

  const weights = await loadEffectiveWeights(mosqueId);

  const families = await prisma.family.findMany({
    where: { id: { in: ids }, mosqueFamilies: { some: { mosqueId } } },
    include: {
      _count: { select: { members: { where: { role: "CHILD" } } } },
    },
  });
  if (families.length === 0) return { recalculated: 0, scores: {}, skipped: false };

  const benefitMap = await countAidBenefitsMany(families.map((f) => f.id));

  const scores = {};
  const updates = [];
  for (const fam of families) {
    const score = computeSVF(fam, {
      benefitCount: benefitMap[fam.id] ?? 0,
      weights,
      childrenCount: fam._count?.members ?? 0,
    });
    const priority = priorityFromScore(score);
    scores[fam.id] = score;
    if (fam.svfScore === score && fam.priority === priority) continue;
    updates.push(
      prisma.family.update({
        where: { id: fam.id },
        data: { svfScore: score, priority },
      }),
    );
  }

  if (updates.length) await prisma.$transaction(updates);
  return { recalculated: updates.length, scores, skipped: false };
}

// Whether the mosque wants the SVF score recalculated automatically whenever
// a family is edited (settings.svf.auto toggle). Missing row / missing
// column (migration not applied yet) both degrade to true, which was the
// previous unconditional behaviour, so nothing regresses for mosques that
// have not touched the setting.
export async function isAutoCalcEnabled(mosqueId) {
  if (!mosqueId) return true;
  try {
    const settings = await prisma.mosqueSettings.findUnique({
      where: { mosqueId },
      select: { autoCalculateSVF: true },
    });
    if (
      !settings ||
      settings.autoCalculateSVF === null ||
      settings.autoCalculateSVF === undefined
    ) {
      return true;
    }
    return Boolean(settings.autoCalculateSVF);
  } catch (e) {
    console.warn(
      "[recalc] Could not read autoCalculateSVF, defaulting to enabled. Cause:",
      e?.code ?? e?.name ?? e,
    );
    return true;
  }
}

// Load the effective SVF weights for a mosque.
//
// Precedence: code defaults < persisted point columns < svfWeights JSON.
// This mirrors effectiveWeightsFor() in /api/settings. Reading only the JSON
// column here meant tuning a point value in Settings changed what the UI
// displayed but NOT how new families were actually scored.
//
// This must never be the reason a request fails: if columns are missing
// because migrations have not been applied yet (Prisma P2022 /
// PrismaClientValidationError), we degrade gracefully to the code-level
// defaults instead of returning a 500 from POST /api/families.
export async function loadEffectiveWeights(mosqueId) {
  if (!mosqueId) return getEffectiveSvfWeights(null);
  try {
    const settings = await prisma.mosqueSettings.findUnique({
      where: { mosqueId },
      select: {
        svfWeights: true,
        ...Object.fromEntries(
          Object.keys(COLUMN_TO_WEIGHT).map((c) => [c, true]),
        ),
      },
    });
    if (!settings) return getEffectiveSvfWeights(null);
    return {
      ...getEffectiveSvfWeights(null),
      ...weightsFromColumns(settings),
      ...getEffectiveSvfWeightsOverrideOnly(settings.svfWeights),
    };
  } catch (e) {
    console.warn(
      "[recalc] Could not read MosqueSettings weights, falling back to SVF defaults. " +
        "Run `npx prisma migrate dev` to sync the database schema. Cause:",
      e?.code ?? e?.name ?? e,
    );
    return getEffectiveSvfWeights(null);
  }
}

// Only the keys explicitly present in the JSON override, so it layers on top of
// the point columns instead of re-applying every default over them.
function getEffectiveSvfWeightsOverrideOnly(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const defaults = getEffectiveSvfWeights(null);
  const out = {};
  for (const [k, v] of Object.entries(json)) {
    if (k in defaults && v !== null && v !== undefined && isFinite(Number(v))) {
      out[k] = Number(v);
    }
  }
  return out;
}
