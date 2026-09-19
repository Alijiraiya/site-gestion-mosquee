// Input guards shared by the API routes.
//
// Why this file exists: the full test run reported 32 responses with HTTP 500
// that should have been 400. They were all the same story -- a value the code
// never checked (a number bigger than a Postgres integer, a boolean sent where
// a number was expected, "0000-00-00" as a date, an unknown enum) travelled
// straight to Prisma, Prisma threw, and Next answered 500 with an empty body.
//
// Nothing here changes what a VALID request does. These helpers only turn a
// crash into a readable message, so the imam sees "Le revenu doit etre un
// nombre" instead of a blank error screen.

// Postgres `integer` range. Anything outside makes Prisma throw.
export const INT32_MIN = -2147483648;
export const INT32_MAX = 2147483647;

// Upper bound for money columns (DA). One thousand billion dinars is far
// beyond any real mosque budget and keeps us inside Decimal precision.
export const MONEY_MAX = 1e12;

// Plausible birth-date window for a human being.
export const MIN_BIRTH_YEAR = 1900;

/**
 * A finite JS number, and nothing else.
 * Rejects booleans, arrays, objects, "", NaN, Infinity -- all of which
 * Number() silently turns into 0, 1 or NaN.
 */
export function isPlainNumber(v) {
  if (typeof v === "boolean") return false;
  if (v === null || v === undefined || v === "") return false;
  if (Array.isArray(v) || typeof v === "object") return false;
  const n = Number(v);
  return Number.isFinite(n);
}

/**
 * Validate one numeric field.
 * @returns [value, errorMessage] -- exactly one of the two is null.
 */
export function numberField(
  value,
  name,
  { min = 0, max = MONEY_MAX, integer = false } = {},
) {
  if (!isPlainNumber(value)) {
    return [null, `${name} must be a number.`];
  }
  let n = Number(value);
  if (integer) {
    if (!Number.isInteger(n)) n = Math.round(n);
    if (n < INT32_MIN || n > INT32_MAX) {
      return [
        null,
        `${name} is out of range. Expected an integer between ${INT32_MIN} and ${INT32_MAX}.`,
      ];
    }
  }
  if (min !== null && n < min) {
    return [null, `${name} cannot be lower than ${min}.`];
  }
  if (max !== null && n > max) {
    return [null, `${name} cannot be greater than ${max}.`];
  }
  return [n, null];
}

/**
 * Validate a date of birth (or any past date).
 * @returns [Date|null, errorMessage]
 */
export function dateField(
  value,
  name,
  { allowNull = false, allowFuture = false, minYear = MIN_BIRTH_YEAR } = {},
) {
  if (value === null || value === undefined || value === "") {
    if (allowNull) return [null, null];
    return [null, `${name} is required.`];
  }
  if (typeof value === "boolean" || typeof value === "object") {
    if (!(value instanceof Date)) return [null, `${name} is not a valid date.`];
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return [null, `${name} is not a valid date.`];
  }
  const year = d.getUTCFullYear();
  if (year < minYear) {
    return [null, `${name} cannot be earlier than ${minYear}.`];
  }
  if (!allowFuture && d.getTime() > Date.now()) {
    return [null, `${name} cannot be in the future.`];
  }
  return [d, null];
}

/**
 * Validate an enum value against an allow-list.
 * @returns [value, errorMessage]
 */
export function enumField(value, name, allowed) {
  if (value === null || value === undefined || value === "") {
    return [null, `${name} is required.`];
  }
  if (typeof value !== "string" || !allowed.includes(value)) {
    return [
      null,
      `Invalid ${name}: ${String(value)}. Expected one of ${allowed.join(", ")}.`,
    ];
  }
  return [value, null];
}

/** A non-empty string once trimmed. Guards against "   " passing a !value test. */
export function requiredText(value, name, { maxLength = 500 } = {}) {
  if (value === null || value === undefined) {
    return [null, `${name} is required.`];
  }
  if (typeof value !== "string" && typeof value !== "number") {
    return [null, `${name} must be a text value.`];
  }
  const s = String(value).trim();
  if (s === "") return [null, `${name} cannot be empty.`];
  if (s.length > maxLength) {
    return [null, `${name} cannot exceed ${maxLength} characters.`];
  }
  return [s, null];
}
