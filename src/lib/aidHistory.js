import { prisma } from "@/lib/prisma";

// ONE definition of "how many times has this family already been helped?".
//
// This number is the 6th input of computeSVF (the "malus d'equite"): each past
// aid removes svf_malus_per_benefit points, capped at svf_max_malus. Before
// this file the count was re-written inline in four different places
// (recalc.js x2, families/[id]/route.js, and nowhere at all in the
// distribution routes), which is exactly why a family's score never moved
// after it received a distribution.
//
// Two rules live here and nowhere else:
//
//  1. A CANCELLED line is NOT an aid received. No money ever left the mosque
//     for it, so it must not lower the family's score. Counting every
//     DistributionItem row -- the previous behaviour -- meant that cancelling
//     a payment left the penalty behind forever.
//  2. A PENDING line IS counted. The distribution has been confirmed, the
//     family is officially on the list, and the fairness malus has to apply
//     immediately so the next simulation does not serve the same family twice.
//     Marking it PAID afterwards keeps the same count, so validating a payment
//     never moves the score a second time.
//
// To switch to "only actually paid aid counts", change this single constant to
// ["PAID"]. Nothing else in the codebase needs to be touched.
export const AID_COUNTED_STATUSES = ["PENDING", "PAID"];

// Prisma `where` fragment shared by every caller.
export function aidCountWhere(familyId) {
  return {
    familyId,
    paymentStatus: { in: AID_COUNTED_STATUSES },
  };
}

/** Number of aids counted for ONE family. */
export async function countAidBenefits(familyId) {
  if (!familyId) return 0;
  return prisma.distributionItem.count({ where: aidCountWhere(familyId) });
}

/**
 * Number of aids counted for MANY families, in a single aggregate query.
 * Returns a plain object { [familyId]: count }; families with no aid at all
 * are absent, so read it with `?? 0`.
 */
export async function countAidBenefitsMany(familyIds) {
  const ids = Array.isArray(familyIds) ? familyIds.filter(Boolean) : [];
  if (ids.length === 0) return {};
  const groups = await prisma.distributionItem.groupBy({
    by: ["familyId"],
    where: {
      familyId: { in: ids },
      paymentStatus: { in: AID_COUNTED_STATUSES },
    },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.familyId, g._count._all]));
}

/**
 * Every family touched by a distribution. Used by the distribution routes to
 * know which families have to be rescored after a confirm / payment /
 * cancellation / deletion.
 */
export async function familyIdsOfDistribution(distributionId) {
  if (!distributionId) return [];
  const items = await prisma.distributionItem.findMany({
    where: { distributionId },
    select: { familyId: true },
  });
  return [...new Set(items.map((i) => i.familyId).filter(Boolean))];
}
