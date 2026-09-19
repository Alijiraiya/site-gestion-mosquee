// Display helpers + label maps that bridge the backend enums to the
// French UI shown in the mockups.

export function formatDA(n) {
  const v = Number(n || 0);
  return `${v.toLocaleString("fr-FR")} DA`;
}

export function formatNumber(n) {
  return Number(n || 0).toLocaleString("fr-FR");
}

export function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function relativeTime(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return formatDate(d);
}

export function ageFromDate(d) {
  if (!d) return "—";
  const birth = new Date(d);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 130 ? age : "—";
}

export function dobFromAge(age) {
  const a = Number(age);
  if (!a || a <= 0) return null;
  const y = new Date().getFullYear() - a;
  return `${y}-01-01`;
}

export function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---- Donation category (enum <-> French label + color) ----
export const DONATION_CATEGORIES = [
  { value: "ZAKAT_MAL", label: "Zakat Mal", color: "#e0b341" },
  { value: "ZAKAT_FITR", label: "Zakat Fitr", color: "#e0b341" },
  { value: "SADAQAH", label: "Sadaqah", color: "#52b788" },
  { value: "don", label: "don", color: "#9b7bd4" },
  { value: "OTHER", label: "Autre", color: "#5b8def" },
];
// KAFFARA is no longer proposed by the app. Donations recorded before its
// removal are still in the database (the Prisma enum is untouched), so they
// are displayed as "Autre" instead of showing a raw enum value.
const LEGACY_CATEGORIES = { KAFFARA: "OTHER" };
export function categoryLabel(v) {
  const key = LEGACY_CATEGORIES[v] || v;
  return DONATION_CATEGORIES.find((c) => c.value === key)?.label || key || "—";
}
export function categoryColor(v) {
  const key = LEGACY_CATEGORIES[v] || v;
  return DONATION_CATEGORIES.find((c) => c.value === key)?.color || "#5b8def";
}

// ---- Payment method ----
export const PAYMENT_METHODS = [
  { value: "CASH", label: "Espèces" },
  { value: "CCP", label: "CCP" },
  { value: "BANK_TRANSFER", label: "Virement" },
];
export function methodLabel(v) {
  return PAYMENT_METHODS.find((m) => m.value === v)?.label || v || "—";
}

// ---- Marital status ----
export const MARITAL_STATUS = [
  { value: "SINGLE", label: "Célibataire" },
  { value: "MARRIED", label: "Marié(e)" },
  { value: "WIDOWED", label: "Veuf(ve)" },
  { value: "DIVORCED", label: "Divorcé(e)" },
];
export function maritalLabel(v) {
  return MARITAL_STATUS.find((m) => m.value === v)?.label || v || "—";
}

// ---- Housing ----
export const HOUSING_STATUS = [
  { value: "OWNER", label: "Propriétaire" },
  { value: "TENANT", label: "Locataire" },
  { value: "HOMELESS", label: "Sans domicile" },
  { value: "TEMPORARY", label: "Temporaire" },
];
export const HOUSING_TYPE = [
  { value: "HOUSE", label: "Maison" },
  { value: "APARTMENT", label: "Appartement" },
  { value: "TEMPORARY", label: "Temporaire" },
  { value: "OTHER", label: "Autre" },
];

// ---- Family member roles ----
export const MEMBER_ROLES = [
  { value: "HEAD", label: "Chef de famille" },
  { value: "SPOUSE", label: "Époux(se)" },
  { value: "CHILD", label: "Fils / Fille" },
  { value: "PARENT", label: "Parent" },
  { value: "OTHER", label: "Autre" },
];
export function memberRoleLabel(v) {
  return MEMBER_ROLES.find((m) => m.value === v)?.label || v || "—";
}

// ---- Priority ----
export const PRIORITY_LABEL = {
  URGENT: "Urgent",
  VULNERABLE: "Vulnérable",
  MODERATE: "Modéré",
  LOW: "Faible",
};
export const PRIORITY_COLOR = {
  URGENT: "#e9806a",
  VULNERABLE: "#e0b341",
  MODERATE: "#5b8def",
  LOW: "#52b788",
};

// ---- Health state helper (derived from hasDisability / diseases) ----
// state: "good" | "warn" | "bad"
export function healthState(family) {
  if (family.hasDisability) return "bad";
  if (family.diseases && String(family.diseases).trim() !== "") return "warn";
  return "good";
}
export const HEALTH_COLOR = {
  good: "#52b788",
  warn: "#e0b341",
  bad: "#e9806a",
};
export const HEALTH_LABEL = {
  good: "Bonne",
  warn: "Maladie",
  bad: "Handicap",
};

// SVF score is stored 0..1 (or sometimes 0..100). Normalize to a 0..100 pct.
export function svfPercent(score) {
  const s = Number(score || 0);
  const pct = s <= 1 ? s * 100 : s;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}
export function svfColor(pct) {
  if (pct >= 66) return "#e9806a";
  if (pct >= 40) return "#e0b341";
  return "#52b788";
}
