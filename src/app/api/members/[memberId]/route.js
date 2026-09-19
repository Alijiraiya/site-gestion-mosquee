import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import {
  toMemberResponse,
  findLinkedMember,
  buildMemberData,
} from "@/lib/familyMembers";
import { syncFamilyFromMembers } from "@/lib/familySync";

// GET /api/members/:memberId -- fetch a single family member.
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const { memberId } = await params;

  const member = await findLinkedMember(mosque.id, memberId);
  if (!member) return fail("Member not found.", 404);
  return ok({ member: toMemberResponse(member) });
}

// PUT /api/members/:memberId -- update a family member.
//
// The head of family is editable here too (the members list now offers a
// "Modifier" action on every row, head included). Because the head is stored
// twice -- as a FamilyMember row AND as columns on Family -- editing it has to
// propagate to the family record before the SVF score is recomputed, otherwise
// changing the head's birth date or disability would silently leave the score
// computed on the old values. That mirroring lives in familySync.js.
export async function PUT(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const { memberId } = await params;

  const existing = await findLinkedMember(mosque.id, memberId);
  if (!existing) return fail("Member not found.", 404);

  const [body, err] = await readJson(request);
  if (err) return err;

  const [data, msg] = buildMemberData(body, { mode: "update" });
  if (msg) return fail(msg);

  // Exactly one head per family: promoting another member to HEAD would leave
  // two heads behind.
  if (data.role === "HEAD" && existing.role !== "HEAD") {
    const otherHead = await prisma.familyMember.findFirst({
      where: { familyId: existing.familyId, role: "HEAD" },
      select: { id: true },
    });
    if (otherHead)
      return fail("This family already has a head of family.", 409);
  }

  // Symmetrically, the head must not be demoted: the family would end up with
  // no head at all, and the header of the file would keep a name that no
  // member row backs any more.
  if (
    existing.role === "HEAD" &&
    data.role !== undefined &&
    data.role !== "HEAD"
  ) {
    return fail(
      "The head of family cannot change role. Edit the family instead.",
      409,
    );
  }

  const member = await prisma.familyMember.update({
    where: { id: memberId },
    data,
  });

  // Role changes move a member in or out of the CHILD count (SVF input) and can
  // turn a member into the spouse, which makes the household married.
  // `headMember` makes the sync copy the head's identity onto the family first.
  const sync = await syncFamilyFromMembers(mosque.id, existing.familyId, {
    promoteToMarried: data.role === "SPOUSE" && existing.role !== "SPOUSE",
    headMember: member.role === "HEAD" ? member : null,
  });

  return ok({
    member: toMemberResponse(member),
    svfScore: sync?.svfScore ?? null,
    maritalStatus: sync?.maritalStatus ?? null,
    maritalStatusChanged: sync?.maritalStatusChanged ?? false,
    // Which Family columns were re-aligned from the head. Empty for any other
    // role; the UI uses it to know it must refresh the family header too.
    headMirrored: sync?.headMirrored ?? {},
  });
}

// DELETE /api/members/:memberId -- remove a family member.
export async function DELETE(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const { memberId } = await params;

  const existing = await findLinkedMember(mosque.id, memberId);
  if (!existing) return fail("Member not found.", 404);

  // The head of family cannot be removed on its own: a family without a head is
  // an orphan record. Deleting the whole family is the intended action.
  if (existing.role === "HEAD") {
    return fail(
      "The head of family cannot be deleted. Delete the family instead.",
      409,
    );
  }

  await prisma.familyMember.delete({ where: { id: memberId } });

  // Removing a CHILD lowers the family's score; keep it in sync. The marital
  // status is never demoted here: only the imam knows whether the head became
  // single, widowed or divorced.
  const sync = await syncFamilyFromMembers(mosque.id, existing.familyId);

  return ok({ message: "Member deleted.", svfScore: sync?.svfScore ?? null });
}
