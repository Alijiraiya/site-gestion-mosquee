import { prisma } from "@/lib/prisma";
import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { computeSVF, priorityFromScore } from "@/lib/svf";
import { loadEffectiveWeights } from "@/lib/recalc";
import { buildMemberData } from "@/lib/familyMembers";
import { normalizeHousing } from "@/lib/housing";
import { marriedFloor, MARRIED } from "@/lib/familySync";
import { dateField, numberField, requiredText } from "@/lib/validate";

// GET /api/families -- list active families for the current mosque (search + filters).
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const { searchParams } = new URL(request.url);
  const search = (
    searchParams.get("search") ||
    searchParams.get("q") ||
    ""
  ).trim();
  // Validate the enum instead of forwarding raw query text to Prisma, and let
  // ?status=ALL list every family instead of returning an empty array.
  const FAMILY_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"];
  // One status is still accepted ("ACTIVE"), and a comma-separated list is now
  // accepted too ("INACTIVE,ARCHIVED"). The "Inactives" section of the families
  // page uses that so an archived family stays reachable there instead of
  // disappearing from the app entirely.
  const statusParam = (searchParams.get("status") || "ACTIVE").toUpperCase();
  const statusList = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const invalidStatus = statusList.filter(
    (s) => s !== "ALL" && !FAMILY_STATUSES.includes(s),
  );
  if (invalidStatus.length) {
    return fail(
      `Invalid status: ${invalidStatus.join(", ")}. Expected one of ${FAMILY_STATUSES.join(", ")} or ALL.`,
    );
  }

  const where = {
    mosqueFamilies: { some: { mosqueId: mosque.id, isActive: true } },
  };
  if (statusList.length && !statusList.includes("ALL"))
    where.status = statusList.length === 1 ? statusList[0] : { in: statusList };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      // The CCP is the identifier printed on every aid receipt and the first
      // thing an imam types to find a file, but it was missing from the search.
      { ccp: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
      { wilaya: { contains: search, mode: "insensitive" } },
      { diseases: { contains: search, mode: "insensitive" } },
    ];
  }

  // Numeric filters: ignore non-numeric input instead of sending NaN to Prisma.
  const maxIncome = Number(searchParams.get("maxIncome"));
  if (Number.isFinite(maxIncome) && searchParams.get("maxIncome"))
    where.monthlyIncome = { lte: maxIncome };
  const minSvf = Number(searchParams.get("minSvf"));
  if (Number.isFinite(minSvf) && searchParams.get("minSvf"))
    where.svfScore = { gte: minSvf };

  // Enum filters: reject unknown values with a 400 rather than a Prisma 500.
  const ENUMS = {
    priority: ["URGENT", "VULNERABLE", "MODERATE", "LOW"],
    employmentStatus: [
      "UNEMPLOYED",
      "PART_TIME",
      "FULL_TIME",
      "RETIRED",
      "DISABLED",
      "NONE",
    ],
    maritalStatus: ["SINGLE", "MARRIED", "WIDOWED", "DIVORCED"],
  };
  for (const [key, allowed] of Object.entries(ENUMS)) {
    const v = searchParams.get(key);
    if (!v) continue;
    if (!allowed.includes(v))
      return fail(`Invalid ${key}: ${v}. Expected one of ${allowed.join(", ")}.`);
    where[key] = v;
  }

  const families = await prisma.family.findMany({
    where,
    orderBy: [{ svfScore: "desc" }, { createdAt: "desc" }],
  });
  return ok({ families, count: families.length });
}

// housingType is deliberately NOT in this list: a "Sans domicile" family has no
// housing type, and requiring it here made those families impossible to save.
// The (status, type) pair is validated together by normalizeHousing().
const REQUIRED = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "ccp",
  "wilaya",
  "address",
  "maritalStatus",
  "housingStatus",
];

const VALID_EMPLOYMENT = [
  "UNEMPLOYED",
  "PART_TIME",
  "FULL_TIME",
  "RETIRED",
  "DISABLED",
  "NONE",
];

// POST /api/families -- create a beneficiary family; SVF score is auto-computed.
export async function POST(request) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  for (const f of REQUIRED) {
    if (body[f] === undefined || body[f] === null || body[f] === "") {
      return fail(`Missing required field: ${f}`);
    }
  }

  const VALID_MARITAL_STATUS = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"];

  if (!VALID_MARITAL_STATUS.includes(body.maritalStatus)) {
    return fail(`Invalid marital status: ${body.maritalStatus}`);
  }

  if (
    body.employmentStatus !== undefined &&
    body.employmentStatus !== null &&
    !VALID_EMPLOYMENT.includes(body.employmentStatus)
  ) {
    return fail(
      `Invalid employmentStatus: ${body.employmentStatus}. Expected one of ${VALID_EMPLOYMENT.join(", ")}.`,
    );
  }

  // ---- Type guards -------------------------------------------------------
  // These four used to travel straight to Prisma. `new Date("tomorrow")`,
  // 1e13 DA of income or `true` as a children count all produced the same
  // useless empty HTTP 500.
  const [dateOfBirth, dobMsg] = dateField(body.dateOfBirth, "dateOfBirth");
  if (dobMsg) return fail(dobMsg);

  const [firstName, fnMsg] = requiredText(body.firstName, "firstName", {
    maxLength: 120,
  });
  if (fnMsg) return fail(fnMsg);
  const [lastName, lnMsg] = requiredText(body.lastName, "lastName", {
    maxLength: 120,
  });
  if (lnMsg) return fail(lnMsg);

  const [monthlyIncome, incomeMsg] = numberField(
    body.monthlyIncome ?? 0,
    "monthlyIncome",
    { min: 0 },
  );
  if (incomeMsg) return fail(incomeMsg);

  const [rentAmount, rentMsg] = numberField(body.rentAmount ?? 0, "rentAmount", {
    min: 0,
  });
  if (rentMsg) return fail(rentMsg);

  const counters = {};
  for (const f of ["childrenSchoolCount", "orphanCount", "elderlyCount"]) {
    const [value, msg] = numberField(body[f] ?? 0, f, {
      min: 0,
      max: 100000,
      integer: true,
    });
    if (msg) return fail(msg);
    counters[f] = value;
  }

  // "Sans domicile" -> the type is not applicable and a neutral value is
  // stored; every other status still requires a real housing type.
  const [housing, housingMsg] = normalizeHousing({
    housingStatus: body.housingStatus,
    housingType: body.housingType ?? null,
  });
  if (housingMsg) return fail(housingMsg);

  const familyData = {
    firstName,
    lastName,
    dateOfBirth,
    ccp: String(body.ccp),
    phone: body.phone ?? null,
    alternativePhone: body.alternativePhone ?? null,
    wilaya: body.wilaya,
    address: body.address,
    monthlyIncome,
    employmentStatus: body.employmentStatus ?? "NONE",
    // No fallback on purpose: "not answered" must never be stored as the
    // meaningful value NONE, which scores +20 on the SVF "Sans soutien"
    // criterion. The form now makes this field mandatory.
    incomeSources: Array.isArray(body.incomeSources) ? body.incomeSources : [],
    rentAmount,
    maritalStatus: body.maritalStatus,
    childrenSchoolCount: counters.childrenSchoolCount,
    orphanCount: counters.orphanCount,
    elderlyCount: counters.elderlyCount,
    documentsOriginalName: body.documentsOriginalName ?? null,
    diseases: typeof body.diseases === "string" ? body.diseases : "",
    hasDisability: Boolean(body.hasDisability ?? false),
    housingStatus: housing.housingStatus,
    housingType: housing.housingType,
    notes: body.notes ?? null,
    createdByMosqueId: mosque.id,
  };

  // Optional inline members. Each is validated with the FamilyMember rules.
  const memberInputs = Array.isArray(body.members) ? body.members : [];
  const membersData = [];
  for (const m of memberInputs) {
    const [data, msg] = buildMemberData(m, { mode: "create" });
    if (msg) return fail(`Invalid member: ${msg}`);
    membersData.push(data);
  }
  const childCount = membersData.filter((m) => m.role === "CHILD").length;

  // The head of family is always a member row. Guarantee it even when the
  // caller did not send one, so the declared size and the member list agree.
  const headCount = membersData.filter((m) => m.role === "HEAD").length;
  if (headCount > 1) return fail("A family can only have one head.");
  if (headCount === 0) {
    membersData.unshift({
      firstName: familyData.firstName,
      lastName: familyData.lastName,
      dateOfBirth: familyData.dateOfBirth,
      role: "HEAD",
      hasDisability: familyData.hasDisability,
    });
  } else {
    // A head WAS supplied: it is the authoritative description of the head, so
    // the family header follows it. Without this the two copies could be born
    // already out of sync and the SVF age criterion would use the wrong date.
    const head = membersData.find((m) => m.role === "HEAD");
    if (head.dateOfBirth) familyData.dateOfBirth = head.dateOfBirth;
    if (head.hasDisability !== undefined)
      familyData.hasDisability = Boolean(head.hasDisability);
    if (!head.lastName) head.lastName = familyData.lastName;
  }

  // A spouse row and a non-married head cannot both be true. This mirrors what
  // POST /api/families/:id/members does when a spouse is added later on, so the
  // rule holds whichever way the family was filled in.
  if (
    membersData.some((m) => m.role === "SPOUSE") &&
    familyData.maritalStatus !== MARRIED
  ) {
    familyData.maritalStatus = MARRIED;
  }

  // Declared household size INCLUDES the head: 1 for a lone head, 2 for a
  // married one, and never smaller than the rows created with the family.
  const floor = marriedFloor(familyData.maritalStatus);
  let declaredMembers = floor;
  if (body.membersCount !== undefined && body.membersCount !== null) {
    const [value, msg] = numberField(body.membersCount, "membersCount", {
      min: 0,
      max: 100000,
      integer: true,
    });
    if (msg) return fail(msg);
    declaredMembers = value;
  }
  familyData.membersCount = Math.max(floor, declaredMembers, membersData.length);

  // Score with the mosque's effective SVF weights, counting CHILD members.
  // benefitCount is 0: a brand-new family has never received aid.
  const weights = await loadEffectiveWeights(mosque.id);
  const svfScore = computeSVF(familyData, {
    benefitCount: 0,
    weights,
    childrenCount: childCount,
  });
  familyData.svfScore = svfScore;
  familyData.priority = priorityFromScore(svfScore);

  try {
    const family = await prisma.$transaction(async (tx) => {
      const fam = await tx.family.create({ data: familyData });
      await tx.mosqueFamily.create({
        data: { mosqueId: mosque.id, familyId: fam.id, createdById: user.id },
      });
      if (membersData.length > 0) {
        await tx.familyMember.createMany({
          data: membersData.map((m) => ({ ...m, familyId: fam.id })),
        });
      }
      return fam;
    });
    return created({ family });
  } catch (e) {
    if (e.code === "P2002")
      return fail("A family with this CCP already exists.", 409);
    throw e;
  }
}
