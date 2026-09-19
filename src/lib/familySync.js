import { prisma } from "@/lib/prisma";
import { recalcFamily, isAutoCalcEnabled } from "@/lib/recalc";

// Keep a family's own fields consistent with the member rows registered for it.
//
// Edge case this file originally closed: a family whose head was saved as
// "Celibataire" stayed single forever even after a SPOUSE was added from the
// detail popup. Registering a spouse IS the statement that the head is
// currently married, so the marital status is promoted to MARRIED (from
// SINGLE, WIDOWED or DIVORCED) and the declared household size follows.
//
// Two deliberate limits:
//  - The promotion only happens when the caller says a spouse was just added or
//    a member was just turned into a spouse (`promoteToMarried`). Any other
//    member change never overrides a status the imam set by hand.
//  - Nothing is ever demoted automatically: deleting a spouse row does not tell
//    us whether the head became single, widowed or divorced.
//
// SECOND ROLE (added with the "modify the head of family" feature): the head of
// family exists TWICE in the database -- once as columns on `Family`
// (firstName, lastName, dateOfBirth, hasDisability, diseases) and once as a
// `FamilyMember` row with role HEAD. Three of those columns are direct SVF
// inputs (age of the head, disability, chronic illness). Now that the head can
// be edited from the members list, the two copies must be mirrored in BOTH
// directions or the score would be computed from a stale copy.

export const MARRIED = "MARRIED";

// Fields duplicated between Family and its HEAD FamilyMember row.
// `family` is the column name, `member` the FamilyMember field.
export const HEAD_MIRRORED_FIELDS = [
  { family: "firstName", member: "firstName" },
  { family: "lastName", member: "lastName" },
  { family: "dateOfBirth", member: "dateOfBirth" }, // SVF: age of the head
  { family: "hasDisability", member: "hasDisability" }, // SVF: health status
  { family: "diseases", member: "diseases" }, // SVF: chronic illness
];

// Declared household size includes the head: 1 alone, 2 once married.
export function marriedFloor(maritalStatus) {
  return maritalStatus === MARRIED ? 2 : 1;
}

function sameValue(a, b) {
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : new Date(a ?? 0).getTime();
    const tb = b instanceof Date ? b.getTime() : new Date(b ?? 0).getTime();
    return ta === tb;
  }
  return (a ?? null) === (b ?? null);
}

/**
 * Copy the HEAD member's identity fields onto the Family record.
 * Called after the head member row was created or edited.
 *
 * Returns the object that was written (empty when nothing changed), so the
 * caller can tell whether an SVF input actually moved.
 */
export async function mirrorHeadToFamily(familyId, headMember) {
  if (!familyId || !headMember || headMember.role !== "HEAD") return {};

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      hasDisability: true,
      diseases: true,
    },
  });
  if (!family) return {};

  const data = {};
  for (const { family: fCol, member: mCol } of HEAD_MIRRORED_FIELDS) {
    const next = headMember[mCol];
    // A member field left empty must not blank out the family record: only a
    // real value is propagated. The one exception is dateOfBirth, where
    // clearing it genuinely means "unknown age" and has to reach the score.
    if (next === undefined) continue;
    if (next === null && mCol !== "dateOfBirth") continue;
    if (mCol === "firstName" && String(next ?? "").trim() === "") continue;
    if (sameValue(family[fCol], next)) continue;
    data[fCol] = next;
  }

  if (Object.keys(data).length === 0) return {};
  await prisma.family.update({ where: { id: familyId }, data });
  return data;
}

/**
 * The other direction: copy the Family's identity fields onto its HEAD member
 * row. Called after PUT /api/families/:id so the members list never shows a
 * head whose name or birth date contradicts the family header.
 */
export async function mirrorFamilyToHead(familyId, familyData) {
  if (!familyId || !familyData) return {};

  const head = await prisma.familyMember.findFirst({
    where: { familyId, role: "HEAD" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      hasDisability: true,
      diseases: true,
    },
  });
  if (!head) return {};

  const data = {};
  for (const { family: fCol, member: mCol } of HEAD_MIRRORED_FIELDS) {
    const next = familyData[fCol];
    if (next === undefined) continue;
    if (sameValue(head[mCol], next)) continue;
    data[mCol] = next;
  }

  if (Object.keys(data).length === 0) return {};
  await prisma.familyMember.update({ where: { id: head.id }, data });
  return data;
}

/**
 * Re-align a family with its member rows, then rescore it.
 *
 * @param {string} mosqueId
 * @param {string} familyId
 * @param {{ promoteToMarried?: boolean, headMember?: object }} options
 *   headMember: pass the HEAD row that was just created or edited to mirror its
 *   identity fields onto the family BEFORE the score is recomputed.
 * @returns {Promise<null | {
 *   maritalStatus: string,
 *   membersCount: number,
 *   memberCount: number,
 *   maritalStatusChanged: boolean,
 *   headMirrored: object,
 *   svfScore: number | null,
 * }>} null when the family is not linked to this mosque.
 */
export async function syncFamilyFromMembers(
  mosqueId,
  familyId,
  { promoteToMarried = false, headMember = null } = {},
) {
  if (!mosqueId || !familyId) return null;

  const family = await prisma.family.findFirst({
    where: { id: familyId, mosqueFamilies: { some: { mosqueId } } },
    select: { id: true, maritalStatus: true, membersCount: true },
  });
  if (!family) return null;

  // Mirror FIRST: the age / disability / illness of the head are SVF inputs, so
  // they have to be on the Family record before the score is recomputed below.
  const headMirrored = headMember
    ? await mirrorHeadToFamily(familyId, headMember)
    : {};

  const [memberCount, spouseCount] = await Promise.all([
    prisma.familyMember.count({ where: { familyId } }),
    prisma.familyMember.count({ where: { familyId, role: "SPOUSE" } }),
  ]);

  const data = {};
  if (promoteToMarried && spouseCount > 0 && family.maritalStatus !== MARRIED) {
    data.maritalStatus = MARRIED;
  }

  const maritalStatus = data.maritalStatus ?? family.maritalStatus;
  // The declared size can never be lower than the rows that actually exist,
  // nor lower than the floor implied by the marital status.
  const membersCount = Math.max(
    Number(family.membersCount) || 1,
    memberCount,
    marriedFloor(maritalStatus),
  );
  if (membersCount !== family.membersCount) data.membersCount = membersCount;

  if (Object.keys(data).length > 0) {
    await prisma.family.update({ where: { id: familyId }, data });
  }

  // Marital status feeds the SVF social-status criterion (widow / divorced
  // points), so rescore AFTER the update, never before -- but only when the
  // mosque has "Calcul automatique du SVF" turned on; otherwise leave the
  // existing score untouched.
  const svfScore = (await isAutoCalcEnabled(mosqueId))
    ? await recalcFamily(mosqueId, familyId)
    : null;

  return {
    maritalStatus,
    membersCount,
    memberCount,
    maritalStatusChanged: data.maritalStatus !== undefined,
    headMirrored,
    svfScore,
  };
}
