import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

// GET /api/families/:id/children/count -- aggregate child counts for a family.
// `count` is derived live from FamilyMember rows with role CHILD; schoolCount
// and orphanCount are the aggregate fields stored on the family record.
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const { id } = await params;

  const family = await prisma.family.findFirst({
    where: { id, mosqueFamilies: { some: { mosqueId: mosque.id } } },
    select: {
      childrenSchoolCount: true,
      orphanCount: true,
      _count: { select: { members: { where: { role: "CHILD" } } } },
    },
  });
  if (!family) return fail("Family not found.", 404);

  return ok({
    count: family._count?.members ?? 0,
    schoolCount: family.childrenSchoolCount,
    orphanCount: family.orphanCount,
  });
}
