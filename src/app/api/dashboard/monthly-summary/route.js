import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

// GET /api/dashboard/monthly-summary?months=6 -- received vs distributed per month.
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const mid = mosque.id;

  // Number("abc") is NaN, and Math.max(1, Math.min(36, NaN)) is also NaN, which
  // produced an Invalid Date and a Prisma 500. Fall back to 6 on junk input.
  const raw = new URL(request.url).searchParams.get("months");
  const parsed = raw === null || raw === "" ? 6 : Number(raw);
  const months = Number.isFinite(parsed)
    ? Math.max(1, Math.min(36, Math.trunc(parsed)))
    : 6;
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  const [donations, dists] = await Promise.all([
    prisma.donation.findMany({
      where: { mosqueId: mid, receivedAt: { gte: start } },
      select: { amount: true, receivedAt: true },
    }),
    prisma.distribution.findMany({
      where: { mosqueId: mid, distributionDate: { gte: start } },
      select: { totalDistributed: true, distributionDate: true },
    }),
  ]);

  const buckets = {};
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    buckets[monthKey(d)] = { month: monthKey(d), received: 0, distributed: 0 };
  }
  for (const x of donations) {
    const k = monthKey(x.receivedAt);
    if (buckets[k]) buckets[k].received += Number(x.amount);
  }
  for (const x of dists) {
    const k = monthKey(x.distributionDate);
    if (buckets[k]) buckets[k].distributed += Number(x.totalDistributed);
  }

  return ok({ months: Object.values(buckets) });
}
