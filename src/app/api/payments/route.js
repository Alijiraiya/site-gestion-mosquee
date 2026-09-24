import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { getBeneficiary } from "@/lib/beneficiary";
import {
  listPayments,
  createPayment,
  validatePaymentInput,
  PAYMENT_STATUSES,
} from "@/lib/payment";

// GET /api/payments -- historique complet (spec §2.3).
// Query: ?beneficiaryId=&status=&from=&to=
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  if (status && !PAYMENT_STATUSES.includes(status))
    return fail(`Invalid status: ${status}. Expected one of ${PAYMENT_STATUSES.join(", ")}.`);

  const payments = await listPayments(mosque.id, {
    beneficiaryId: searchParams.get("beneficiaryId") || undefined,
    status,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
  });
  return ok({ payments, count: payments.length });
}

// POST /api/payments -- record a payment (spec §2.2). Defaults to an
// already-settled disbursement (status PAID); pass status: "PENDING" to
// schedule a future installment instead.
export async function POST(request) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  const [data, validationError] = validatePaymentInput(body);
  if (validationError) return fail(validationError);

  const beneficiary = await getBeneficiary(mosque.id, data.beneficiaryId);
  if (!beneficiary) return fail("Beneficiary not found.", 404);

  const payment = await createPayment(mosque.id, user.id, data, beneficiary);
  return created({ payment });
}
