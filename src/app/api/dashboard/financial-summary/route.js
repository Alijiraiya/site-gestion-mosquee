import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

// GET /api/dashboard/financial-summary -- cash-only in/out/balance.
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const mid = mosque.id;

  const [cashIn, out] = await Promise.all([
    prisma.donation.aggregate({
      _sum: { amount: true },
      where: { mosqueId: mid, paymentMethod: "CASH" },
    }),
    prisma.distribution.aggregate({
      _sum: { totalDistributed: true },
      where: { mosqueId: mid },
    }),
  ]);

  const totalIn = Number(cashIn._sum.amount ?? 0);
  const totalOut = Number(out._sum.totalDistributed ?? 0);
  return ok({ totalIn, totalOut, balance: totalIn - totalOut });
}
