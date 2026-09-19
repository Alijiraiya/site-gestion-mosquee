import { prisma } from "@/lib/prisma";
import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import {
  toMemberResponse,
  findLinkedFamily,
  buildMemberData,
  FAMILY_MEMBER_ROLES,
} from "@/lib/familyMembers";
import { syncFamilyFromMembers } from "@/lib/familySync";

// GET /api/families/:id/members -- list every member of one family.
// Optional ?role=CHILD filter.
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const { id } = await params;

  const family = await findLinkedFamily(mosque.id, id);
  if (!family) return fail("Family not found.", 404);

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const where = { familyId: family.id };
  if (role) {
    if (!FAMILY_MEMBER_ROLES.includes(role))
      return fail(`Invalid role: ${role}`);
    where.role = role;
  }

  const members = await prisma.familyMember.findMany({
    where,
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  return ok({
    members: members.map(toMemberResponse),
    count: members.length,
  });
}

// POST /api/families/:id/members -- add a member to a family.
// Body: { firstName, role, lastName?, dateOfBirth?, hasDisability?, diseases?,
//         occupation?, monthlyIncome? }
//
// Adding a SPOUSE also promotes the head of family to "Marie(e)": a registered
// spouse and a "Celibataire" head cannot both be true, and the SVF score is
// recomputed with the corrected status.
export async function POST(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const { id } = await params;

  const family = await findLinkedFamily(mosque.id, id);
  if (!family) return fail("Family not found.", 404);

  const [body, err] = await readJson(request);
  if (err) return err;

  const [data, msg] = buildMemberData(body, { mode: "create" });
  if (msg) return fail(msg);

  // Exactly one head per family: the HEAD row is created together with the
  // family itself, so it can never be added again here.
  if (data.role === "HEAD") {
    const existingHead = await prisma.familyMember.findFirst({
      where: { familyId: family.id, role: "HEAD" },
      select: { id: true },
    });
    if (existingHead)
      return fail("This family already has a head of family.", 409);
  }

  const member = await prisma.familyMember.create({
    data: { ...data, familyId: family.id },
  });

  // A new CHILD changes the SVF inputs and a new SPOUSE changes the marital
  // status, so re-align the family and rescore it in one place. When the row
  // created here IS the head (a family repaired after an import), its identity
  // is mirrored onto the family record before scoring.
  const sync = await syncFamilyFromMembers(mosque.id, family.id, {
    promoteToMarried: data.role === "SPOUSE",
    headMember: member.role === "HEAD" ? member : null,
  });

  return created({
    member: toMemberResponse(member),
    svfScore: sync?.svfScore ?? null,
    // The client uses these to refresh the row without a full reload and to
    // tell the imam that the marital status was corrected.
    maritalStatus: sync?.maritalStatus ?? family.maritalStatus,
    maritalStatusChanged: sync?.maritalStatusChanged ?? false,
    membersCount: sync?.membersCount ?? family.membersCount,
  });
}
