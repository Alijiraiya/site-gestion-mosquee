// Housing rules shared by the intake form and the API routes.
//
// Edge case this file closes: a family declared "Sans domicile" (HOMELESS) has
// no housing TYPE. The form correctly disables the "Type de logement" select
// and sends nothing, but the API listed `housingType` as unconditionally
// required, so saving failed with "Missing required field: housingType" and a
// homeless family could never be registered at all.
//
// The rule now lives in ONE place: for the statuses listed below the type is
// not required, and a neutral value is stored so the (non-nullable) column
// stays valid while the UI keeps displaying "Non applicable". No DB migration
// is needed.

export const HOUSING_STATUSES = ["OWNER", "TENANT", "HOMELESS", "TEMPORARY"];
export const HOUSING_TYPES = ["HOUSE", "APARTMENT", "TEMPORARY", "OTHER"];

// Housing statuses that have no housing type at all.
export const STATUS_WITHOUT_HOUSING_TYPE = ["HOMELESS"];

// Value persisted when the housing type does not apply. It is never displayed
// as-is: housingTypeApplies() tells the UI to render "Non applicable" instead.
export const HOUSING_TYPE_NOT_APPLICABLE = "OTHER";

// Does this housing status require the imam to pick a housing type?
export function requiresHousingType(housingStatus) {
  return !STATUS_WITHOUT_HOUSING_TYPE.includes(housingStatus);
}

// Is the stored housingType meaningful for this family?
export function housingTypeApplies(family) {
  return requiresHousingType(family?.housingStatus);
}

// Validate + normalize a (status, type) pair.
// Returns [{ housingStatus, housingType }, errorMessage].
export function normalizeHousing({ housingStatus, housingType } = {}) {
  if (!housingStatus) return [null, "Missing required field: housingStatus"];
  if (!HOUSING_STATUSES.includes(housingStatus)) {
    return [null, `Invalid housing status: ${housingStatus}`];
  }

  // "Sans domicile": whatever the client sent is meaningless, and its absence
  // must never block the registration.
  if (!requiresHousingType(housingStatus)) {
    return [{ housingStatus, housingType: HOUSING_TYPE_NOT_APPLICABLE }, null];
  }

  if (!housingType) return [null, "Missing required field: housingType"];
  if (!HOUSING_TYPES.includes(housingType)) {
    return [null, `Invalid housing type: ${housingType}`];
  }

  return [{ housingStatus, housingType }, null];
}
