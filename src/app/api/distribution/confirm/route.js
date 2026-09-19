import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { calculateWaterFilling } from "@/lib/waterFilling";
import { recalcFamilies } from "@/lib/recalc";

// POST /api/distribution/confirm -- apply a distribution and update the balance.
// Body: { title?, budget, notes?, familyIds?, distributions?, method?, reserve?, minAmt?, maxAmt? }
// If `distributions` (explicit allocations) are provided they are used as-is;
// otherwise a Water-Filling allocation is recomputed from the budget.
export async function POST(request) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  const budget = Number(body.budget ?? body.totalBudget);
  if (!(budget > 0)) return fail("A positive 'budget' is required.");
  const title =
    body.title || `Distribution ${new Date().toISOString().slice(0, 10)}`;

  let allocations = body.distributions;
  let method = "WATER_FILLING";

  if (!Array.isArray(allocations) || !allocations.length) {
    const where = {
      status: "ACTIVE",
      mosqueFamilies: { some: { mosqueId: mosque.id, isActive: true } },
    };
    if (Array.isArray(body.familyIds) && body.familyIds.length)
      where.id = { in: body.familyIds };
    const families = await prisma.family.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        svfScore: true,
        priority: true,
      },
    });
    const result = calculateWaterFilling(families, budget, {
      reserve: body.reserve !== undefined ? Number(body.reserve) : undefined,
      minAmt: body.minAmt !== undefined ? Number(body.minAmt) : undefined,
      maxAmt: body.maxAmt !== undefined ? Number(body.maxAmt) : undefined,
    });
    if (!result.success) return fail(result.message, 422);
    allocations = result.distributions;
  } else {
    method = body.method || "MANUAL";
  }

  const famIds = allocations.map((a) => a.familyId);
  // Mirror the eligibility filter used by /distribution/calculate. Without
  // `status: ACTIVE` and `isActive: true`, a family archived or unlinked
  // between simulating and confirming would still be paid, because the caller
  // posts back the allocation list computed earlier.
  const fams = await prisma.family.findMany({
    where: {
      id: { in: famIds },
      status: "ACTIVE",
      mosqueFamilies: { some: { mosqueId: mosque.id, isActive: true } },
    },
    select: { id: true, svfScore: true, priority: true },
  });
  const famMap = Object.fromEntries(fams.map((f) => [f.id, f]));
  if (fams.length !== famIds.length) {
    const missing = famIds.filter((id) => !famMap[id]);
    return fail(
      "One or more families are no longer eligible: they do not belong to " +
        "this mosque, or they were deactivated or archived since the " +
        "simulation was run. Re-run the simulation. Family id(s): " +
        missing.join(", "),
      400,
    );
  }

  // This is the *planned* total (sum of all item amounts) -- used only to
  // sanity-check available balance right now. The actual `totalDistributed`
  // column on Distribution tracks money that has genuinely left the mosque,
  // i.e. items marked PAID -- see PUT /api/distributions/:id, where each
  // PAID mark increments it and decrements mosque.balance at that moment,
  // not here at creation time.
  const plannedTotal = allocations.reduce((a, x) => a + Number(x.amount), 0);

  const freshMosque = await prisma.mosque.findUnique({
    where: { id: mosque.id },
  });
  if (Number(freshMosque.balance) < plannedTotal) {
    return fail(
      `Insufficient mosque balance. Available: ${Number(freshMosque.balance)}, required: ${plannedTotal}.`,
      422,
    );
  }

  const distribution = await prisma.$transaction(async (tx) => {
    const dist = await tx.distribution.create({
      data: {
        mosqueId: mosque.id,
        title,
        totalBudget: budget,
        // Nothing has actually been paid out yet -- items start PENDING.
        totalDistributed: 0,
        method,
        // Items start PENDING -- the distribution itself isn't COMPLETED
        // until every item has been marked PAID or CANCELLED (see
        // PUT /api/distributions/:id, which flips this once nothing is
        // PENDING anymore).
        status: "APPROVED",
        notes: body.notes ?? null,
        createdById: user.id,
        generatedAutomatically: method === "WATER_FILLING",
        items: {
          create: allocations.map((a) => ({
            familyId: a.familyId,
            amount: Number(a.amount),
            svfSnapshot:
              famMap[a.familyId]?.svfScore ?? Number(a.svfScore ?? 0),
            prioritySnapshot: famMap[a.familyId]?.priority ?? "LOW",
          })),
        },
      },
      include: { items: true },
    });
    // NOTE: mosque.balance is intentionally NOT decremented here anymore.
    // Money only actually leaves the mosque's balance when an individual
    // item is marked PAID (see PUT /api/distributions/:id).
    await tx.family.updateMany({
      where: { id: { in: famIds } },
      data: { lastAidAt: new Date() },
    });
    return dist;
  });

  // ---- SVF re-synchronisation ------------------------------------------
  // THIS is the missing link that made scores drift. Confirming a
  // distribution creates one DistributionItem per family, and that count is
  // the 6th input of computeSVF (the "malus d'equite": each aid already
  // received removes points so the same family is not served twice in a row).
  // The count changed, therefore the stored svfScore and priority are stale
  // the moment this transaction commits, and the NEXT simulation would rank
  // families on yesterday's numbers.
  //
  // svfSnapshot / prioritySnapshot above are deliberately captured BEFORE
  // this call: an item must remember the score that justified its amount.
  const resync = await recalcFamilies(mosque.id, famIds);

  return ok({
    distribution,
    // Post-distribution scores, so the UI can refresh the family list without
    // a second round-trip. `skipped` is true when the mosque turned
    // "Calcul automatique du SVF" off, in which case nothing was rescored.
    svfScores: resync.scores,
    svfRecalculated: resync.recalculated,
    svfAutoCalcDisabled: resync.skipped,
  });
}
