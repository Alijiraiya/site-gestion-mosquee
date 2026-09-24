import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { getBeneficiary } from "@/lib/beneficiary";
import { getBeneficiaryPaymentSummary } from "@/lib/payment";

// GET /api/beneficiaries/:id/payments -- "Fiche bénéficiaire" (spec §2.3):
// every payment for this beneficiary plus the cumulative amount actually
// paid.
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const { id } = await params;
  const beneficiary = await getBeneficiary(mosque.id, id);
  if (!beneficiary) return fail("Beneficiary not found.", 404);

  const { payments, totalPaid } = await getBeneficiaryPaymentSummary(mosque.id, id);
  return ok({ beneficiary, payments, totalPaid });
}
