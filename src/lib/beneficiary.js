// Beneficiary directory (cahier des charges §2.1): the people the mosque
// pays -- imam, muezzin, maintenance staff, artisans, suppliers. Payment
// (src/lib/payment.js) always points at a beneficiary from this directory.
// Marwa's expense.js also reads this directory for the beneficiary
// auto-completion field on an expense (spec §1.1).

import { prisma } from "@/lib/prisma";
import { numberField, enumField, requiredText } from "@/lib/validate";

export const BENEFICIARY_ROLES = [
  "IMAM",
  "MUEZZIN",
  "MAINTENANCE_STAFF",
  "ARTISAN",
  "SUPPLIER",
  "OTHER",
];
export const BENEFICIARY_PAYMENT_TYPES = ["REGULAR", "OCCASIONAL"];
export const PAYMENT_FREQUENCIES = ["WEEKLY", "MONTHLY"];
export const DISBURSEMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE"];

/**
 * Validate a beneficiary payload.
 * @param {object} body - raw request body
 * @param {{ partial?: boolean }} opts - partial: skip required-field checks
 *   for fields the caller didn't send (used by PUT, which only updates the
 *   fields actually present in the body).
 * @returns [cleanedData, errorMessage] -- exactly one of the two is null.
 */
export function validateBeneficiaryInput(body, { partial = false } = {}) {
  const data = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (!partial || has("firstName")) {
    const [v, err] = requiredText(body.firstName, "firstName", { maxLength: 120 });
    if (err) return [null, err];
    data.firstName = v;
  }
  if (!partial || has("lastName")) {
    const [v, err] = requiredText(body.lastName, "lastName", { maxLength: 120 });
    if (err) return [null, err];
    data.lastName = v;
  }
  if (!partial || has("role")) {
    const [v, err] = enumField(body.role, "role", BENEFICIARY_ROLES);
    if (err) return [null, err];
    data.role = v;
  }
  if (!partial || has("paymentType")) {
    const [v, err] = enumField(
      body.paymentType ?? "OCCASIONAL",
      "paymentType",
      BENEFICIARY_PAYMENT_TYPES,
    );
    if (err) return [null, err];
    data.paymentType = v;
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

  // paymentFrequency only makes sense for REGULAR beneficiaries -- see
  // schema comment on Beneficiary.paymentFrequency.
  const effectiveType = data.paymentType ?? body.paymentType;
  if (has("paymentFrequency") || effectiveType === "REGULAR") {
    if (body.paymentFrequency === undefined || body.paymentFrequency === null) {
      if (effectiveType === "REGULAR" && !partial)
        return [null, "paymentFrequency is required for a REGULAR beneficiary."];
      data.paymentFrequency = null;
    } else {
      const [v, err] = enumField(
        body.paymentFrequency,
        "paymentFrequency",
        PAYMENT_FREQUENCIES,
      );
      if (err) return [null, err];
      data.paymentFrequency = v;
    }
  }

  if (has("usualAmount")) {
    if (body.usualAmount === null || body.usualAmount === "") {
      data.usualAmount = null;
    } else {
      const [v, err] = numberField(body.usualAmount, "usualAmount", { min: 0 });
      if (err) return [null, err];
      data.usualAmount = v;
    }
  }

  if (has("phone")) data.phone = body.phone ? String(body.phone).trim() : null;
  if (has("email")) data.email = body.email ? String(body.email).trim() : null;
  if (has("notes")) data.notes = body.notes ? String(body.notes).trim() : null;

  return [data, null];
}

// GET list -- optional filters: role, paymentType, isActive, and a free-text
// search over firstName/lastName (used by the amount's auto-completion
// field, spec §1.1 and §2.2).
export async function listBeneficiaries(mosqueId, { role, paymentType, isActive, search } = {}) {
  const where = { mosqueId };
  if (role) where.role = role;
  if (paymentType) where.paymentType = paymentType;
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.beneficiary.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getBeneficiary(mosqueId, id) {
  return prisma.beneficiary.findFirst({ where: { id, mosqueId } });
}

export async function createBeneficiary(mosqueId, userId, data) {
  return prisma.beneficiary.create({
    data: {
      mosqueId,
      createdById: userId,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role ?? "OTHER",
      paymentType: data.paymentType ?? "OCCASIONAL",
      paymentFrequency: data.paymentFrequency ?? null,
      usualAmount: data.usualAmount ?? null,
      paymentMethod: data.paymentMethod ?? "CASH",
      phone: data.phone ?? null,
      email: data.email ?? null,
      notes: data.notes ?? null,
    },
  });
}

// Returns the updated beneficiary, or null if it doesn't exist in this mosque.
export async function updateBeneficiary(mosqueId, id, data) {
  const existing = await getBeneficiary(mosqueId, id);
  if (!existing) return null;
  return prisma.beneficiary.update({ where: { id }, data });
}

// Soft-disable only -- a beneficiary with past Payment rows can never be
// hard-deleted without breaking that history (same pattern as Donor).
// Returns the updated beneficiary, or null if it doesn't exist in this mosque.
export async function setBeneficiaryActive(mosqueId, id, isActive) {
  const existing = await getBeneficiary(mosqueId, id);
  if (!existing) return null;
  return prisma.beneficiary.update({ where: { id }, data: { isActive } });
}
