// Payments to beneficiaries (cahier des charges §2.2/§2.3).
//
// A Payment row can be:
//  - PENDING: a due/expected installment, not yet settled. Either created
//    manually ahead of time, or auto-generated for REGULAR beneficiaries by
//    generateDueInstallments() below (spec §2.3: "le systeme genere
//    automatiquement les echeances de paiement pour les beneficiaires
//    reguliers").
//  - PAID: an actual disbursement, with paidAt set.
//  - CANCELLED: a scheduled installment that will never be paid (e.g. the
//    beneficiary left) -- kept for history instead of deleted.
//
// Recording a payment does NOT touch Mosque.balance or create a cash
// movement -- that ledger write belongs to Serine 1's cashMovement.js
// (Caisse), which doesn't exist yet. Once it does, hook it in wherever a
// payment transitions to PAID below.

import { prisma } from "@/lib/prisma";
import { dateField, enumField } from "@/lib/validate";
import { DISBURSEMENT_METHODS } from "@/lib/beneficiary";

export const PAYMENT_STATUSES = ["PENDING", "PAID", "CANCELLED"];
export { DISBURSEMENT_METHODS };

// How many days ahead of the due date the J-3 reminder fires.
const REMINDER_DAYS_BEFORE = 3;
// How many days after the due date a still-unpaid installment counts as late.
const LATE_AFTER_DAYS = 1;

/**
 * Validate a payment payload.
 * @returns [cleanedData, errorMessage]
 */
export function validatePaymentInput(body, { partial = false } = {}) {
  const data = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (!partial || has("beneficiaryId")) {
    if (!body.beneficiaryId) return [null, "beneficiaryId is required."];
    data.beneficiaryId = String(body.beneficiaryId);
  }
  if (!partial || has("amount")) {
    const amount = Number(body.amount);
    if (!(amount > 0)) return [null, "A positive amount is required."];
    data.amount = amount;
  }
  if (!partial || has("scheduledDate")) {
    const [v, err] = dateField(body.scheduledDate, "scheduledDate", { allowFuture: true });
    if (err) return [null, err];
    data.scheduledDate = v;
  }
  if (!partial || has("paymentMethod")) {
    const [v, err] = enumField(
      body.paymentMethod ?? "CASH",
      "paymentMethod",
      DISBURSEMENT_METHODS,
    );
    if (err) return [null, err];
    data.paymentMethod = v;
  }
  if (has("status")) {
    const [v, err] = enumField(body.status, "status", PAYMENT_STATUSES);
    if (err) return [null, err];
    data.status = v;
  }
  if (has("periodLabel"))
    data.periodLabel = body.periodLabel ? String(body.periodLabel).trim() : null;
  if (has("note")) data.note = body.note ? String(body.note).trim() : null;
  if (has("envelopeName"))
    data.envelopeName = body.envelopeName ? String(body.envelopeName).trim() : null;

  return [data, null];
}

// data.beneficiaryId must already be verified to belong to mosqueId by the
// caller (see getBeneficiary in beneficiary.js) -- `beneficiary` is the
// already-fetched row, passed in to default paymentMethod and avoid a
// second lookup.
export async function createPayment(mosqueId, userId, data, beneficiary) {
  const status = data.status ?? "PAID";
  return prisma.payment.create({
    data: {
      mosqueId,
      beneficiaryId: data.beneficiaryId,
      amount: data.amount,
      scheduledDate: data.scheduledDate,
      paidAt: status === "PAID" ? data.scheduledDate ?? new Date() : null,
      periodLabel: data.periodLabel ?? null,
      paymentMethod: data.paymentMethod ?? beneficiary.paymentMethod,
      status,
      note: data.note ?? null,
      envelopeName: data.envelopeName ?? null,
      createdById: userId,
    },
  });
}

// GET list -- historique complet (spec §2.3): filters by beneficiary,
// status, and a scheduledDate range.
export async function listPayments(mosqueId, { beneficiaryId, status, from, to } = {}) {
  const where = { mosqueId };
  if (beneficiaryId) where.beneficiaryId = beneficiaryId;
  if (status) where.status = status;
  if (from || to) {
    const range = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) range.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) range.lte = d;
    }
    if (Object.keys(range).length) where.scheduledDate = range;
  }

  return prisma.payment.findMany({
    where,
    orderBy: { scheduledDate: "desc" },
    include: {
      beneficiary: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
}

export async function getPayment(mosqueId, id) {
  return prisma.payment.findFirst({
    where: { id, mosqueId },
    include: {
      beneficiary: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
}

// Fiche beneficiaire (spec §2.3): full payment history for one beneficiary
// plus the cumulative total actually paid.
export async function getBeneficiaryPaymentSummary(mosqueId, beneficiaryId) {
  const payments = await prisma.payment.findMany({
    where: { mosqueId, beneficiaryId },
    orderBy: { scheduledDate: "desc" },
  });
  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  return { payments, totalPaid };
}

// Edit a PENDING payment's fields. Once a payment is PAID or CANCELLED it is
// locked (same "status can no longer be changed" rule already used for
// DistributionItem elsewhere in this codebase) -- correct it via
// setPaymentStatus instead of silently rewriting a settled record.
// @returns { payment } | { error: "NOT_FOUND" | "LOCKED" }
export async function updatePayment(mosqueId, id, data) {
  const existing = await prisma.payment.findFirst({ where: { id, mosqueId } });
  if (!existing) return { error: "NOT_FOUND" };
  if (existing.status !== "PENDING") return { error: "LOCKED" };
  const payment = await prisma.payment.update({ where: { id }, data });
  return { payment };
}

// Transition a payment's status. PAID stamps paidAt (now, unless one is
// given); PENDING clears it (a manual "un-pay" correction); CANCELLED
// leaves paidAt untouched.
// @returns { payment } | { error: "NOT_FOUND" | "LOCKED" }
export async function setPaymentStatus(mosqueId, id, status, { paidAt } = {}) {
  const existing = await prisma.payment.findFirst({ where: { id, mosqueId } });
  if (!existing) return { error: "NOT_FOUND" };
  if (existing.status === "CANCELLED") return { error: "LOCKED" };

  const payment = await prisma.payment.update({
    where: { id },
    data: {
      status,
      paidAt: status === "PAID" ? paidAt ?? new Date() : status === "PENDING" ? null : undefined,
    },
  });
  return { payment };
}

// Upcoming/late alerts over PENDING payments (spec §2.3):
//  - "Rappel J-3": due within the next REMINDER_DAYS_BEFORE days.
//  - "Non-paiement J+1": still PENDING more than LATE_AFTER_DAYS days after
//    its due date.
// This returns plain data -- there is no push-notification delivery yet
// (that lands with Serine 1's notifications.js); the dashboard (Serine 2)
// or a future notification job can consume this directly.
export async function getPaymentAlerts(mosqueId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const reminderCutoff = new Date(startOfToday);
  reminderCutoff.setDate(reminderCutoff.getDate() + REMINDER_DAYS_BEFORE);
  const lateCutoff = new Date(startOfToday);
  lateCutoff.setDate(lateCutoff.getDate() - LATE_AFTER_DAYS);

  const pending = await prisma.payment.findMany({
    where: { mosqueId, status: "PENDING" },
    orderBy: { scheduledDate: "asc" },
    include: {
      beneficiary: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return {
    upcoming: pending.filter(
      (p) => p.scheduledDate >= startOfToday && p.scheduledDate <= reminderCutoff,
    ),
    late: pending.filter((p) => p.scheduledDate <= lateCutoff),
  };
}

function nextDueDate(fromDate, frequency) {
  const d = new Date(fromDate);
  if (frequency === "WEEKLY") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1); // MONTHLY
  return d;
}

// Ensures every active REGULAR beneficiary has one upcoming PENDING
// installment scheduled, creating it (amount = usualAmount, due date =
// last payment + frequency) if none exists yet.
//
// There is no job scheduler in this codebase (docs/10_Missing_Features.md),
// so for now this runs on demand via POST /api/payments/generate-due
// rather than on a timer -- wire it into a cron job once one exists.
// userId is attributed as createdById on any row it creates.
export async function generateDueInstallments(mosqueId, userId) {
  const beneficiaries = await prisma.beneficiary.findMany({
    where: { mosqueId, isActive: true, paymentType: "REGULAR" },
  });

  const created = [];
  for (const b of beneficiaries) {
    if (!b.paymentFrequency || b.usualAmount == null) continue;

    const alreadyPending = await prisma.payment.findFirst({
      where: { mosqueId, beneficiaryId: b.id, status: "PENDING" },
    });
    if (alreadyPending) continue; // an installment is already waiting

    const lastPaid = await prisma.payment.findFirst({
      where: { mosqueId, beneficiaryId: b.id, status: "PAID" },
      orderBy: { scheduledDate: "desc" },
    });
    const base = lastPaid ? lastPaid.scheduledDate : b.createdAt;
    const due = nextDueDate(base, b.paymentFrequency);

    const payment = await prisma.payment.create({
      data: {
        mosqueId,
        beneficiaryId: b.id,
        amount: b.usualAmount,
        scheduledDate: due,
        paymentMethod: b.paymentMethod,
        status: "PENDING",
        createdById: userId,
      },
    });
    created.push(payment);
  }
  return created;
}
