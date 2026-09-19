import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

// GET /api/dashboard/stats -- key figures for the home dashboard.
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const mid = mosque.id;

  const activeFamilyWhere = {
    status: "ACTIVE",
    mosqueFamilies: { some: { mosqueId: mid, isActive: true } },
  };

  const [
    familyCount,
    donorCount,
    donationCount,
    childrenCount,
    received,
    distributed,
    fresh,
  ] = await Promise.all([
    prisma.family.count({ where: activeFamilyWhere }),
    prisma.donor.count({ where: { mosqueId: mid } }),
    prisma.donation.count({ where: { mosqueId: mid } }),
    // Children are FamilyMember rows with role CHILD in active linked families.
    prisma.familyMember.count({
      where: { role: "CHILD", family: activeFamilyWhere },
    }),
    prisma.donation.aggregate({
      _sum: { amount: true },
      where: { mosqueId: mid },
    }),
    prisma.distribution.aggregate({
      _sum: { totalDistributed: true },
      where: { mosqueId: mid },
    }),
    prisma.mosque.findUnique({ where: { id: mid }, select: { balance: true } }),
  ]);

  return ok({
    families: familyCount,
    children: childrenCount,
    donors: donorCount,
    donations: donationCount,
    totalReceived: Number(received._sum.amount ?? 0),
    totalDistributed: Number(distributed._sum.totalDistributed ?? 0),
    balance: Number(fresh?.balance ?? 0),
  });
}
