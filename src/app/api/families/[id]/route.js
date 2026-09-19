import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { computeSVF, priorityFromScore } from "@/lib/svf";
import { loadEffectiveWeights, isAutoCalcEnabled } from "@/lib/recalc";
import { normalizeHousing } from "@/lib/housing";
import { marriedFloor, mirrorFamilyToHead } from "@/lib/familySync";
import { countAidBenefits } from "@/lib/aidHistory";
import { dateField, numberField, requiredText } from "@/lib/validate";

const VALID_MARITAL_STATUS = ["SINGLE", "MARRIED", "WIDOWED", "DIVORCED"];
const VALID_FAMILY_STATUS = ["ACTIVE", "INACTIVE", "ARCHIVED"];
const VALID_EMPLOYMENT = [
  "UNEMPLOYED",
  "PART_TIME",
  "FULL_TIME",
  "RETIRED",
  "DISABLED",
  "NONE",
];
const DELETE_MODES = ["soft", "hard"];

// Decimal(14,2) money columns and Int counters. Sending 1e13 or `true` used to
// reach Prisma untouched and come back as an empty HTTP 500.
const MONEY_FIELDS = ["monthlyIncome", "rentAmount"];
const COUNT_FIELDS = [
  "membersCount",
  "childrenSchoolCount",
  "orphanCount",
  "elderlyCount",
];

async function linkedFamily(mosqueId, id) {
  return prisma.family.findFirst({
    where: { id, mosqueFamilies: { some: { mosqueId } } },
  });
}

// GET /api/families/:id -- full record, with its members.
//
// The members are included now: the detail popup used to need a second request
// to show them, and every caller that wanted to know the real headcount had to
// guess it from membersCount.
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { id } = await params;
  const family = await prisma.family.findFirst({
    where: { id, mosqueFamilies: { some: { mosqueId: mosque?.id } } },
    include: {
      mosqueFamilies: { where: { mosqueId: mosque?.id } },
      members: { orderBy: [{ role: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!family) return fail("Family not found.", 404);
  return ok({ family });
}

// PUT /api/families/:id -- update and recompute the SVF score.
export async function PUT(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { id } = await params;
  const existing = await linkedFamily(mosque?.id, id);
  if (!existing) return fail("Family not found.", 404);
  const [body, err] = await readJson(request);
  if (err) return err;

  // NOTE: `commune` is deliberately absent -- the Family model has no commune
  // column (only Mosque does), so accepting it here would make Prisma throw.
  const editable = [
    "firstName",
    "lastName",
    "phone",
    "alternativePhone",
    "wilaya",
    "address",
    "monthlyIncome",
    "employmentStatus",
    "incomeSources",
    "rentAmount",
    "maritalStatus",
    "membersCount",
    "childrenSchoolCount",
    "orphanCount",
    "elderlyCount",
    "documentsOriginalName",
    "diseases",
    "hasDisability",
    "housingStatus",
    "housingType",
    "notes",
    "status",
  ];
  const data = {};
  for (const f of editable) if (body[f] !== undefined) data[f] = body[f];

  // ---- Type guards: turn a would-be 500 into a readable 400 --------------
  if (body.dateOfBirth !== undefined) {
    const [dob, msg] = dateField(body.dateOfBirth, "dateOfBirth");
    if (msg) return fail(msg);
    data.dateOfBirth = dob;
  }

  for (const f of ["firstName", "lastName"]) {
    if (data[f] === undefined) continue;
    const [value, msg] = requiredText(data[f], f, { maxLength: 120 });
    if (msg) return fail(msg);
    data[f] = value;
  }

  for (const f of MONEY_FIELDS) {
    if (data[f] === undefined) continue;
    const [value, msg] = numberField(data[f], f, { min: 0 });
    if (msg) return fail(msg);
    data[f] = value;
  }

  for (const f of COUNT_FIELDS) {
    if (data[f] === undefined) continue;
    const [value, msg] = numberField(data[f], f, {
      min: 0,
      max: 100000,
      integer: true,
    });
    if (msg) return fail(msg);
    data[f] = value;
  }

  if (data.hasDisability !== undefined)
    data.hasDisability = Boolean(data.hasDisability);

  if (data.diseases !== undefined) {
    if (data.diseases === null) data.diseases = "";
    else if (typeof data.diseases !== "string")
      return fail("diseases must be a text value.");
  }

  if (data.incomeSources !== undefined && !Array.isArray(data.incomeSources)) {
    return fail("incomeSources must be an array.");
  }

  // Validate enums here instead of letting Prisma answer with a 500.
  if (
    data.maritalStatus !== undefined &&
    !VALID_MARITAL_STATUS.includes(data.maritalStatus)
  ) {
    return fail(`Invalid marital status: ${data.maritalStatus}`);
  }
  if (data.status !== undefined && !VALID_FAMILY_STATUS.includes(data.status)) {
    return fail(`Invalid status: ${data.status}`);
  }
  if (
    data.employmentStatus !== undefined &&
    !VALID_EMPLOYMENT.includes(data.employmentStatus)
  ) {
    return fail(
      `Invalid employmentStatus: ${data.employmentStatus}. Expected one of ${VALID_EMPLOYMENT.join(", ")}.`,
    );
  }

  // Housing: normalize the MERGED pair so that switching a family to "Sans
  // domicile" never demands a housing type, and switching back to a housed
  // status still requires a real one.
  if (data.housingStatus !== undefined || data.housingType !== undefined) {
    const [housing, housingMsg] = normalizeHousing({
      housingStatus: data.housingStatus ?? existing.housingStatus,
      housingType: data.housingType ?? existing.housingType,
    });
    if (housingMsg) return fail(housingMsg);
    data.housingStatus = housing.housingStatus;
    data.housingType = housing.housingType;
  }

  const [benefitCount, childCount, memberTotal, weights, autoCalc] =
    await Promise.all([
      // Single source of truth for the fairness malus: CANCELLED aid does not
      // count (see src/lib/aidHistory.js). Reading the raw item count here was
      // one of the three places where the rule had been duplicated, and they
      // had already drifted apart.
      countAidBenefits(id),
      prisma.familyMember.count({ where: { familyId: id, role: "CHILD" } }),
      prisma.familyMember.count({ where: { familyId: id } }),
      loadEffectiveWeights(mosque.id),
      isAutoCalcEnabled(mosque.id),
    ]);

  // Declared household size includes the head, so the floor is 1 for a lone
  // head and 2 for a married one, and it can never be edited down below the
  // members already registered for this family.
  const floor = marriedFloor(data.maritalStatus ?? existing.maritalStatus);
  if (data.membersCount !== undefined) {
    data.membersCount = Math.max(floor, data.membersCount, memberTotal);
  } else if (existing.membersCount < floor) {
    // Switching a family to MARRIED raises the household floor even when the
    // count itself was not part of the edit.
    data.membersCount = floor;
  }

  // "Calcul automatique du SVF" (settings) gates this: when the mosque has
  // turned it off, edits to a family must not silently overwrite the score
  // an imam entered or last saw. When it's on (the default), every edit
  // rescoring keeps the SVF live, exactly as the setting's hint promises.
  if (autoCalc) {
    const merged = { ...existing, ...data };
    const svfScore = computeSVF(merged, {
      benefitCount,
      weights,
      childrenCount: childCount,
    });
    data.svfScore = svfScore;
    data.priority = priorityFromScore(svfScore);
  }

  const family = await prisma.family.update({ where: { id }, data });

  // The head of family is stored twice (Family columns + the HEAD member row).
  // Renaming the family or correcting the head's birth date here must reach
  // the member list too, otherwise the popup would show a head who no longer
  // matches the file header.
  const headMirrored = await mirrorFamilyToHead(id, data);

  return ok({ family, headMirrored });
}

// DELETE /api/families/:id -- remove a family.
//
//   ?mode=soft (default) -> archive: the row stays in Postgres, only
//     Family.status becomes ARCHIVED. The family leaves the active list, the
//     dashboard counters and the distribution calculation, but stays visible
//     in the "Inactives" section of the families page, and its members, its
//     documents and its aid history are all kept. Reversible by setting the
//     status back to ACTIVE (PUT /api/families/:id).
//   ?mode=hard            -> permanent: the family, its members and its
//     documents are erased. Refused when the family already received aid,
//     because every DistributionItem must keep pointing at a real family;
//     archiving is the only safe option in that case.
export async function DELETE(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const { id } = await params;
  const existing = await linkedFamily(mosque.id, id);
  if (!existing) return fail("Family not found.", 404);

  const { searchParams } = new URL(request.url);
  const mode = (
    searchParams.get("mode") ||
    (searchParams.get("permanent") === "1" ? "hard" : "soft")
  ).toLowerCase();
  if (!DELETE_MODES.includes(mode)) {
    return fail(
      `Invalid mode: ${mode}. Expected one of ${DELETE_MODES.join(", ")}.`,
    );
  }

  if (mode === "hard") {
    // Every item counts here, CANCELLED included: the point is referential
    // integrity, not scoring. A cancelled line still points at this family.
    const aidCount = await prisma.distributionItem.count({
      where: { familyId: id },
    });
    if (aidCount > 0) {
      return fail(
        `This family is part of ${aidCount} distribution(s). Permanent deletion would break the aid history -- archive it instead.`,
        409,
      );
    }

    try {
      const counts = await prisma.$transaction(async (tx) => {
        const members = await tx.familyMember.deleteMany({
          where: { familyId: id },
        });
        const documents = await tx.familyDocument.deleteMany({
          where: { familyId: id },
        });
        await tx.mosqueFamily.deleteMany({ where: { familyId: id } });
        await tx.family.delete({ where: { id } });
        return { members: members.count, documents: documents.count };
      });
      return ok({
        deleted: true,
        mode,
        ...counts,
        message: "Family permanently deleted.",
      });
    } catch (e) {
      // Any leftover reference (a distribution created in the meantime) must not
      // surface as a 500.
      if (e.code === "P2003" || e.code === "P2014") {
        return fail(
          "This family is still referenced by other records -- archive it instead.",
          409,
        );
      }
      throw e;
    }
  }

  // Archiving touches exactly ONE column: Family.status. The row stays in
  // Postgres with all its data, its members, its documents and its aid
  // history. The link to the mosque stays active on purpose: that is what
  // keeps the family visible in the "Inactives" section of the list. Being
  // ARCHIVED instead of ACTIVE is already enough to keep it out of the
  // dashboard counters and out of the distribution calculation.
  await prisma.family.update({ where: { id }, data: { status: "ARCHIVED" } });
  return ok({
    deleted: false,
    mode,
    status: "ARCHIVED",
    message: "Family archived (soft delete).",
  });
}
