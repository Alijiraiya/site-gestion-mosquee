import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { recalcFamilies } from "@/lib/recalc";
import { familyIdsOfDistribution } from "@/lib/aidHistory";

// GET /api/distributions/:id -- single distribution with items and families.
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { id } = await params;
  const distribution = await prisma.distribution.findFirst({
    where: { id, mosqueId: mosque?.id },
    include: {
      items: {
        include: {
          family: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              svfScore: true,
              priority: true,
            },
          },
        },
      },
    },
  });
  if (!distribution) return fail("Distribution not found.", 404);
  return ok({ distribution });
}

// PUT /api/distributions/:id -- update a single item's payment status
// (mark as paid / cancelled) within this distribution, OR update the
// distribution's own workflow status/notes.
// Body: { itemId, paymentStatus: "PAID" | "CANCELLED" }  -- item-level
//    or: { status?, notes? }                             -- distribution-level
//
// Item-level notes:
// - Once an item is PAID or CANCELLED its status is locked -- further
//   updates to that item are rejected (no reverting back to PENDING).
// - Money only actually leaves the mosque's balance at THIS point, when an
//   item is marked PAID -- not when the distribution was first created (see
//   /api/distribution/confirm, which no longer touches balance). Marking an
//   item CANCELLED has no monetary effect: nothing was ever deducted for
//   it, so there's nothing to refund.
// - The parent distribution auto-flips to COMPLETED once no item is left
//   PENDING, unless it was manually set to CANCELLED via the
//   distribution-level branch below, in which case we leave it alone.
// - SVF: validating a payment keeps the family's aid count unchanged (a
//   PENDING line already counted), but CANCELLING one removes it, so the
//   family gets its points back. Both branches rescore -- see the calls to
//   recalcFamilies below and the rule in src/lib/aidHistory.js.
const VALID_STATUSES = ["PAID", "CANCELLED"];

export async function PUT(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { id } = await params;

  const [body, jsonErr] = await readJson(request);
  if (jsonErr) return jsonErr;
  const { itemId, paymentStatus, status, notes } = body;

  // Two distinct edits are supported:
  //   { status }               -> change the distribution's own workflow state
  //   { itemId, paymentStatus} -> mark one family's payment as paid/cancelled
  const wantsStatus = status !== undefined || notes !== undefined;
  if (!wantsStatus && (!itemId || !paymentStatus)) {
    return fail(
      "Provide either { status } to update the distribution, or { itemId, paymentStatus } to update one item.",
    );
  }

  // Ensure the distribution belongs to this mosque before touching anything.
  const distribution = await prisma.distribution.findFirst({
    where: { id, mosqueId: mosque?.id },
    select: { id: true, status: true },
  });
  if (!distribution) return fail("Distribution not found.", 404);

  if (wantsStatus) {
    const DISTRIBUTION_STATUSES = [
      "DRAFT",
      "APPROVED",
      "COMPLETED",
      "CANCELLED",
    ];
    const data = {};
    if (status !== undefined) {
      if (!DISTRIBUTION_STATUSES.includes(status)) {
        return fail(
          `Invalid status: ${status}. Expected one of ${DISTRIBUTION_STATUSES.join(", ")}.`,
        );
      }
      data.status = status;
    }
    if (notes !== undefined) data.notes = notes;

    // Cancelling the whole distribution must cancel the lines that were still
    // waiting. Otherwise those PENDING items kept weighing on every family's
    // SVF score for a distribution that will never be paid.
    const affected =
      data.status === "CANCELLED" ? await familyIdsOfDistribution(id) : [];

    const updated = await prisma.$transaction(async (tx) => {
      if (data.status === "CANCELLED") {
        await tx.distributionItem.updateMany({
          where: { distributionId: id, paymentStatus: "PENDING" },
          data: { paymentStatus: "CANCELLED" },
        });
      }
      return tx.distribution.update({ where: { id }, data });
    });

    const resync = affected.length
      ? await recalcFamilies(mosque.id, affected)
      : { recalculated: 0, scores: {}, skipped: false };

    return ok({
      distribution: updated,
      svfScores: resync.scores,
      svfRecalculated: resync.recalculated,
    });
  }

  if (!VALID_STATUSES.includes(paymentStatus)) {
    return fail("Invalid paymentStatus.");
  }

  const item = await prisma.distributionItem.findFirst({
    where: { id: itemId, distributionId: id },
  });
  if (!item) return fail("Distribution item not found.", 404);

  if (item.paymentStatus === "PAID" || item.paymentStatus === "CANCELLED") {
    return fail("This item's status can no longer be changed.", 409);
  }

  const amount = Number(item.amount);

  if (paymentStatus === "PAID") {
    // Balance may have moved since the distribution was created (other
    // payouts, new donations, etc.) -- check right now, not just at
    // creation time, so we never push the mosque into a negative balance.
    const freshMosque = await prisma.mosque.findUnique({
      where: { id: mosque.id },
      select: { balance: true },
    });
    if (Number(freshMosque.balance) < amount) {
      return fail(
        `Insufficient mosque balance to mark this item as paid. Available: ${Number(freshMosque.balance)}, required: ${amount}.`,
        422,
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (paymentStatus === "PAID") {
      await tx.mosque.update({
        where: { id: mosque.id },
        data: { balance: { decrement: amount } },
      });
      await tx.distribution.update({
        where: { id },
        data: { totalDistributed: { increment: amount } },
      });
    }
    // CANCELLED: no balance or totalDistributed change -- nothing was ever
    // deducted for this item.

    const result = await tx.distributionItem.update({
      where: { id: itemId },
      data: {
        paymentStatus,
        paidAt: paymentStatus === "PAID" ? new Date() : undefined,
      },
      include: {
        family: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            svfScore: true,
            priority: true,
          },
        },
      },
    });

    // Auto-complete once every item has been resolved (no PENDING left) --
    // but don't override a distribution someone has manually set to
    // CANCELLED via the { status } branch above.
    if (distribution.status !== "CANCELLED") {
      const remainingPending = await tx.distributionItem.count({
        where: { distributionId: id, paymentStatus: "PENDING" },
      });
      if (remainingPending === 0) {
        await tx.distribution.update({
          where: { id },
          data: { status: "COMPLETED" },
        });
      }
    }

    return result;
  });

  // ---- SVF re-synchronisation ------------------------------------------
  // PAID   -> the family stays counted as helped; the score is confirmed at
  //           its post-distribution value (idempotent, no double malus).
  // CANCELLED -> the line no longer counts as aid received, so the malus is
  //           removed and the family climbs back to where it was.
  const resync = await recalcFamilies(mosque.id, [item.familyId]);

  return ok({
    item: updated,
    svfScore: resync.scores[item.familyId] ?? null,
    svfAutoCalcDisabled: resync.skipped,
  });
}

// DELETE /api/distributions/:id -- delete a distribution and restore the
// balance for whatever has actually been paid out so far (totalDistributed
// now only reflects items marked PAID -- see PUT above -- so this correctly
// refunds only real money that left the mosque, not the full planned budget).
export async function DELETE(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { id } = await params;
  const existing = await prisma.distribution.findFirst({
    where: { id, mosqueId: mosque?.id },
  });
  if (!existing) return fail("Distribution not found.", 404);

  // Capture the beneficiaries BEFORE the cascade removes the items, otherwise
  // there is no way left to know whose score has to go back up.
  const affected = await familyIdsOfDistribution(id);

  await prisma.$transaction(async (tx) => {
    await tx.mosque.update({
      where: { id: mosque.id },
      data: { balance: { increment: Number(existing.totalDistributed) } },
    });
    await tx.distribution.delete({ where: { id } }); // items cascade
  });

  // The aid lines are gone, so the fairness malus they carried must be gone
  // too: every beneficiary recovers the points this distribution had cost it.
  const resync = await recalcFamilies(mosque.id, affected);

  return ok({
    message: "Distribution deleted and balance restored.",
    svfScores: resync.scores,
    svfRecalculated: resync.recalculated,
  });
}
