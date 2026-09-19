import { prisma } from "@/lib/prisma";
import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { recalcFamilies } from "@/lib/recalc";
import { numberField } from "@/lib/validate";

// GET /api/distributions -- list distributions with beneficiary family names.
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const distributions = await prisma.distribution.findMany({
    where: { mosqueId: mosque.id },
    orderBy: { distributionDate: "desc" },
    include: {
      items: {
        include: {
          family: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  return ok({ distributions, count: distributions.length });
}

// POST /api/distributions -- record a single manual aid to one family.
// Body: { familyId, amount, title?, notes?, itemNote? }
//   notes    -> note on the distribution itself
//   itemNote -> note on the single line item (`note` is a legacy alias)
//
// Unlike /api/distribution/confirm this endpoint records money that has
// ALREADY been handed over: the balance is debited immediately and the
// distribution is created COMPLETED. Its single item must therefore be created
// PAID, not PENDING -- a COMPLETED distribution holding a PENDING line was
// self-contradictory and made the "remaining to pay" figures wrong.
export async function POST(request) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  if (!body.familyId) return fail("familyId is required.");
  const [amount, amountMsg] = numberField(body.amount, "amount", { min: 0 });
  if (amountMsg) return fail(amountMsg);
  if (!(amount > 0)) return fail("A positive amount is required.");

  const family = await prisma.family.findFirst({
    where: {
      id: body.familyId,
      mosqueFamilies: { some: { mosqueId: mosque.id } },
    },
  });
  if (!family) return fail("Family not found.", 404);

  const fresh = await prisma.mosque.findUnique({ where: { id: mosque.id } });
  if (Number(fresh.balance) < amount) {
    return fail(
      `Insufficient mosque balance. Available: ${Number(fresh.balance)}.`,
      422,
    );
  }

  const now = new Date();
  const distribution = await prisma.$transaction(async (tx) => {
    const dist = await tx.distribution.create({
      data: {
        mosqueId: mosque.id,
        title: body.title || `Aid to ${family.firstName} ${family.lastName}`,
        totalBudget: amount,
        totalDistributed: amount,
        method: "MANUAL",
        status: "COMPLETED",
        notes: body.notes ?? null,
        createdById: user.id,
        generatedAutomatically: false,
        items: {
          create: [
            {
              familyId: family.id,
              amount,
              svfSnapshot: family.svfScore,
              prioritySnapshot: family.priority,
              // The money is already out: the line is PAID from the start,
              // consistent with status COMPLETED and totalDistributed above.
              paymentStatus: "PAID",
              paidAt: now,
              // Do NOT fall back to body.notes here: that copied the
              // distribution-level note onto the line item, so every manual
              // aid record showed the same text twice.
              notes: body.itemNote ?? body.note ?? null,
            },
          ],
        },
      },
      include: { items: true },
    });
    await tx.mosque.update({
      where: { id: mosque.id },
      data: { balance: { decrement: amount } },
    });
    await tx.family.update({
      where: { id: family.id },
      data: { lastAidAt: now },
    });
    return dist;
  });

  // One more aid received -> one more fairness malus -> new SVF score.
  // Without this the family kept its pre-aid score and would be served first
  // again in the very next simulation.
  const resync = await recalcFamilies(mosque.id, [family.id]);

  return created({
    distribution,
    svfScore: resync.scores[family.id] ?? null,
    svfAutoCalcDisabled: resync.skipped,
  });
}
