import { prisma } from "@/lib/prisma";
import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { computeSVF, priorityFromScore } from "@/lib/svf";
import { loadEffectiveWeights } from "@/lib/recalc";
import { buildMemberData } from "@/lib/familyMembers";

// GET /api/families -- list active families for the current mosque (search + filters).
// working
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
  const statusParam = (searchParams.get("status") || "ACTIVE").toUpperCase();
  if (statusParam !== "ALL" && !FAMILY_STATUSES.includes(statusParam)) {
    return fail(
      `Invalid status: ${statusParam}. Expected one of ${FAMILY_STATUSES.join(", ")} or ALL.`,
    );
  }

  const where = {
    mosqueFamilies: { some: { mosqueId: mosque.id, isActive: true } },
  };
  if (statusParam !== "ALL") where.status = statusParam;

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
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

const REQUIRED = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "ccp",
  "wilaya",
  "address",
  "maritalStatus",
  "housingStatus",
  "housingType",
];

// POST /api/families -- create a beneficiary family; SVF score is auto-computed.
// working
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
  const familyData = {
    firstName: body.firstName,
    lastName: body.lastName,
    dateOfBirth: new Date(body.dateOfBirth),
    ccp: String(body.ccp),
    phone: body.phone ?? null,
    alternativePhone: body.alternativePhone ?? null,
    wilaya: body.wilaya,
    address: body.address,
    monthlyIncome: body.monthlyIncome ?? 0,
    employmentStatus: body.employmentStatus ?? "NONE",
    incomeSources: body.incomeSources ?? ["NONE"],
    rentAmount: body.rentAmount ?? 0,
    maritalStatus: body.maritalStatus,
    childrenSchoolCount: Number(body.childrenSchoolCount ?? 0),
    orphanCount: Number(body.orphanCount ?? 0),
    elderlyCount: Number(body.elderlyCount ?? 0),
    documentsOriginalName: body.documentsOriginalName ?? null,
    diseases: body.diseases ?? "",
    hasDisability: Boolean(body.hasDisability ?? false),
    housingStatus: body.housingStatus,
    housingType: body.housingType,
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

  // Score with the mosque's effective SVF weights, counting CHILD members.
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
