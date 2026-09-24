import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import {
  getBeneficiary,
  updateBeneficiary,
  setBeneficiaryActive,
  validateBeneficiaryInput,
} from "@/lib/beneficiary";

// GET /api/beneficiaries/:id -- single beneficiary (fiche bénéficiaire,
// spec §2.3 -- the cumulative payment total is served by
// GET /api/beneficiaries/:id/payments in payment.js, not duplicated here).
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const { id } = await params;
  const beneficiary = await getBeneficiary(mosque.id, id);
  if (!beneficiary) return fail("Beneficiary not found.", 404);
  return ok({ beneficiary });
}

// PUT /api/beneficiaries/:id -- update beneficiary info.
export async function PUT(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  const [data, validationError] = validateBeneficiaryInput(body, { partial: true });
  if (validationError) return fail(validationError);
  if (Object.keys(data).length === 0)
    return fail("No updatable field was provided.");

  const { id } = await params;
  const beneficiary = await updateBeneficiary(mosque.id, id, data);
  if (!beneficiary) return fail("Beneficiary not found.", 404);
  return ok({ beneficiary });
}

// DELETE /api/beneficiaries/:id -- soft-disable (isActive = false), never a
// hard delete: past Payment rows must keep pointing at this beneficiary.
// A disabled beneficiary drops out of the auto-completion list (spec §1.1)
// but its payment history stays intact.
export async function DELETE(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const { id } = await params;
  const beneficiary = await setBeneficiaryActive(mosque.id, id, false);
  if (!beneficiary) return fail("Beneficiary not found.", 404);
  return ok({ beneficiary });
}
