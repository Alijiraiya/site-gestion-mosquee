import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import {
  toMemberResponse,
  findLinkedMember,
  buildMemberData,
} from "@/lib/familyMembers";
import { recalcFamily } from "@/lib/recalc";

// A "child" is a FamilyMember with role CHILD. Guard that the target member is
// both linked to the mosque and actually a CHILD.
async function findLinkedChild(mosqueId, childId) {
  const member = await findLinkedMember(mosqueId, childId);
  if (!member || member.role !== "CHILD") return null;
  return member;
}

// PUT /api/children/:childId -- update a child record.
export async function PUT(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const { childId } = await params;

  const existing = await findLinkedChild(mosque.id, childId);
  if (!existing) return fail("Child not found.", 404);

  const [body, err] = await readJson(request);
  if (err) return err;

  // Keep the row a CHILD even if the body tries to change the role.
  const [data, msg] = buildMemberData(body, {
    mode: "update",
    forcedRole: "CHILD",
  });
  if (msg) return fail(msg);

  const child = await prisma.familyMember.update({
    where: { id: childId },
    data,
  });

  // Keep the family's SVF score in sync with its CHILD records.
  const svfScore = await recalcFamily(mosque.id, existing.familyId);

  return ok({ child: toMemberResponse(child), svfScore });
}

// DELETE /api/children/:childId -- remove a child record.
export async function DELETE(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const { childId } = await params;

  const existing = await findLinkedChild(mosque.id, childId);
  if (!existing) return fail("Child not found.", 404);

  await prisma.familyMember.delete({ where: { id: childId } });

  // One fewer child means a lower score; recompute it now.
  const svfScore = await recalcFamily(mosque.id, existing.familyId);

  return ok({ message: "Child deleted.", svfScore });
}
