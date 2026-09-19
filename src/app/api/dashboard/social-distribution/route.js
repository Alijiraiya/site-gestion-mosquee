import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

// GET /api/dashboard/social-distribution -- breakdown of active families by
// social situation (marital status) and by SVF priority level (for pie charts).
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const mid = mosque.id;

  const where = {
    status: "ACTIVE",
    mosqueFamilies: { some: { mosqueId: mid, isActive: true } },
  };

  const [byMarital, byPriority] = await Promise.all([
    prisma.family.groupBy({
      by: ["maritalStatus"],
      _count: { _all: true },
      where,
    }),
    prisma.family.groupBy({ by: ["priority"], _count: { _all: true }, where }),
  ]);

  return ok({
    byMaritalStatus: byMarital.map((g) => ({
      status: g.maritalStatus,
      count: g._count._all,
    })),
    byPriority: byPriority.map((g) => ({
      priority: g.priority,
      count: g._count._all,
    })),
  });
}
