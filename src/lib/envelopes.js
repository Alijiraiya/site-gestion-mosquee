import { numberField, requiredText, enumField, dateField } from "./validate.js";

export const ENVELOPE_CATEGORIES = [
  "MAINTENANCE",
  "UTILITIES",
  "SALARIES",
  "EVENTS",
  "SOCIAL",
  "SUPPLIES",
  "OTHER",
];

export const ENVELOPE_PERIODS = [
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
  "CUSTOM",
];

export const ENVELOPE_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "CLOSED",
  "EXHAUSTED",
];

export const CATEGORY_METADATA = {
  MAINTENANCE: {
    label: "Maintenance & Travaux",
    arLabel: "الصيانة والأشغال",
    icon: "tools",
    color: "#f59e0b", // Amber
    bgColor: "rgba(245, 158, 11, 0.12)",
  },
  UTILITIES: {
    label: "Factures (Eau, Électricité)",
    arLabel: "الفواتير (ماء، كهرباء)",
    icon: "zap",
    color: "#3b82f6", // Blue
    bgColor: "rgba(59, 130, 246, 0.12)",
  },
  SALARIES: {
    label: "Rémunérations & Salaires",
    arLabel: "الرواتب والمكافآت",
    icon: "users",
    color: "#10b981", // Emerald
    bgColor: "rgba(16, 185, 129, 0.12)",
  },
  EVENTS: {
    label: "Événements religieux & Iftar",
    arLabel: "المناسبات الدينية والإفطار",
    icon: "calendar",
    color: "#8b5cf6", // Purple
    bgColor: "rgba(139, 92, 246, 0.12)",
  },
  SOCIAL: {
    label: "Aide sociale directe",
    arLabel: "المساعدات الاجتماعية المباشرة",
    icon: "heart",
    color: "#ec4899", // Pink
    bgColor: "rgba(236, 72, 153, 0.12)",
  },
  SUPPLIES: {
    label: "Fournitures & Consommables",
    arLabel: "المستلزمات والمستهلكات",
    icon: "package",
    color: "#06b6d4", // Cyan
    bgColor: "rgba(6, 182, 212, 0.12)",
  },
  OTHER: {
    label: "Autres dépenses",
    arLabel: "مصاريف أخرى",
    icon: "moreHorizontal",
    color: "#6b7280", // Gray
    bgColor: "rgba(107, 114, 128, 0.12)",
  },
};

export const PERIOD_METADATA = {
  MONTHLY: { label: "Mensuel", arLabel: "شهري" },
  QUARTERLY: { label: "Trimestriel", arLabel: "فصلي" },
  ANNUAL: { label: "Annuel", arLabel: "سنوي" },
  CUSTOM: { label: "Personnalisé", arLabel: "مخصص" },
};

/**
 * Calculates consumption metrics and health state for an envelope
 */
export function calculateEnvelopeMetrics(allocated, spent, alertThreshold = 80) {
  const alloc = Math.max(0, Number(allocated) || 0);
  const sp = Math.max(0, Number(spent) || 0);
  const remaining = alloc - sp;
  const consumedRate = alloc > 0 ? (sp / alloc) * 100 : 0;
  const threshold = Math.min(100, Math.max(1, Number(alertThreshold) || 80));

  let healthState = "HEALTHY";
  if (remaining <= 0) {
    healthState = "EXHAUSTED";
  } else if (consumedRate >= threshold) {
    healthState = "WARNING";
  }

  // Health color token for badges and progress bars
  let statusColor = "#10b981"; // Green (Healthy)
  if (healthState === "EXHAUSTED") {
    statusColor = "#ef4444"; // Red
  } else if (healthState === "WARNING") {
    statusColor = "#f59e0b"; // Orange/Amber
  } else if (consumedRate >= 70) {
    statusColor = "#eab308"; // Yellow (approaching threshold)
  }

  return {
    allocatedAmount: alloc,
    spentAmount: sp,
    remainingAmount: remaining,
    consumedRate: Math.round(consumedRate * 100) / 100,
    alertThreshold: threshold,
    healthState,
    statusColor,
    isOverBudget: sp > alloc,
    isAtOrNearAlert: consumedRate >= threshold,
  };
}

/**
 * Validates envelope payload before create or update
 */
export function validateEnvelopePayload(data, { isUpdate = false } = {}) {
  const errors = {};

  // Name validation
  if (!isUpdate || data.name !== undefined) {
    const [name, err] = requiredText(data.name, "Nom de l'enveloppe", { maxLength: 120 });
    if (err) errors.name = err;
  }

  // Category validation
  if (!isUpdate || data.category !== undefined) {
    const [cat, err] = enumField(data.category, "Catégorie", ENVELOPE_CATEGORIES);
    if (err) errors.category = err;
  }

  // Period Type validation
  if (!isUpdate || data.periodType !== undefined) {
    const [period, err] = enumField(data.periodType, "Type de période", ENVELOPE_PERIODS);
    if (err) errors.periodType = err;
  }

  // Allocated Amount
  if (!isUpdate || data.allocatedAmount !== undefined) {
    const [amount, err] = numberField(data.allocatedAmount, "Montant alloué", {
      min: 1,
      max: 1e12,
    });
    if (err) errors.allocatedAmount = err;
  }

  // Alert Threshold
  if (data.alertThreshold !== undefined) {
    const [threshold, err] = numberField(data.alertThreshold, "Seuil d'alerte", {
      min: 1,
      max: 100,
      integer: true,
    });
    if (err) errors.alertThreshold = err;
  }

  // Dates
  let startD = null;
  let endD = null;
  if (!isUpdate || data.startDate !== undefined) {
    const [s, err] = dateField(data.startDate, "Date de début", { allowFuture: true });
    if (err) errors.startDate = err;
    startD = s;
  }
  if (!isUpdate || data.endDate !== undefined) {
    const [e, err] = dateField(data.endDate, "Date de fin", { allowFuture: true });
    if (err) errors.endDate = err;
    endD = e;
  }

  if (startD && endD && startD.getTime() > endD.getTime()) {
    errors.endDate = "La date de fin doit être postérieure à la date de début.";
  }

  // Status (if provided)
  if (data.status !== undefined) {
    const [st, err] = enumField(data.status, "Statut", ENVELOPE_STATUSES);
    if (err) errors.status = err;
  }

  const hasErrors = Object.keys(errors).length > 0;
  return { isValid: !hasErrors, errors };
}

/**
 * Validates status transitions
 */
export function canTransitionStatus(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;

  switch (currentStatus) {
    case "DRAFT":
      return ["ACTIVE", "CLOSED"].includes(newStatus);
    case "ACTIVE":
      return ["CLOSED", "EXHAUSTED"].includes(newStatus);
    case "EXHAUSTED":
      return ["ACTIVE", "CLOSED"].includes(newStatus);
    case "CLOSED":
      return ["ACTIVE"].includes(newStatus); // Reopen
    default:
      return false;
  }
}
