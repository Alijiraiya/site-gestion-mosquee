import { prisma } from "@/lib/prisma";
import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import {
  toMemberResponse,
  findLinkedFamily,
  buildMemberData,
} from "@/lib/familyMembers";
import { recalcFamily } from "@/lib/recalc";

// Children are FamilyMember rows with role CHILD. These endpoints are kept for
// backwards compatibility; /api/families/:id/members exposes all roles.

// GET /api/families/:id/children -- list a family's children.
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const { id } = await params;

  const family = await findLinkedFamily(mosque.id, id);
  if (!family) return fail("Family not found.", 404);

  const children = await prisma.familyMember.findMany({
    where: { familyId: family.id, role: "CHILD" },
    orderBy: { createdAt: "asc" },
  });
  return ok({
    children: children.map(toMemberResponse),
    count: children.length,
  });
}

// POST /api/families/:id/children -- add a child to a family.
export async function POST(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const { id } = await params;

  const family = await findLinkedFamily(mosque.id, id);
  if (!family) return fail("Family not found.", 404);

  const [body, err] = await readJson(request);
  if (err) return err;

  // Force role CHILD regardless of the payload.
  const [data, msg] = buildMemberData(body, {
    mode: "create",
    forcedRole: "CHILD",
  });
  if (msg) return fail(msg);

  const child = await prisma.familyMember.create({
    data: { ...data, familyId: family.id },
  });

  // The CHILD count feeds computeSVF, so the family's score and priority are
  // now stale. Previously they were only ever computed at creation time, which
  // meant adding children never changed the SVF score.
  const svfScore = await recalcFamily(mosque.id, family.id);

  return created({ child: toMemberResponse(child), svfScore });
}
