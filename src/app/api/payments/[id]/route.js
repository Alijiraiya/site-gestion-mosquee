import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { getPayment, updatePayment, setPaymentStatus, validatePaymentInput } from "@/lib/payment";

// GET /api/payments/:id
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const { id } = await params;
  const payment = await getPayment(mosque.id, id);
  if (!payment) return fail("Payment not found.", 404);
  return ok({ payment });
}

// PUT /api/payments/:id -- edit a still-PENDING payment. Once PAID or
// CANCELLED, use /pay to settle it or DELETE to cancel it instead of
// editing fields on a locked record.
export async function PUT(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  const [data, validationError] = validatePaymentInput(body, { partial: true });
  if (validationError) return fail(validationError);
  if (Object.keys(data).length === 0) return fail("No updatable field was provided.");

  const { id } = await params;
  const result = await updatePayment(mosque.id, id, data);
  if (result.error === "NOT_FOUND") return fail("Payment not found.", 404);
  if (result.error === "LOCKED") return fail("This item's status can no longer be changed.", 409);
  return ok({ payment: result.payment });
}

// DELETE /api/payments/:id -- cancel a PENDING installment. Never a hard
// delete: a financial record stays visible in the history (spec §2.3),
// just marked CANCELLED instead of PENDING/PAID.
export async function DELETE(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const { id } = await params;
  const result = await setPaymentStatus(mosque.id, id, "CANCELLED");
  if (result.error === "NOT_FOUND") return fail("Payment not found.", 404);
  if (result.error === "LOCKED") return fail("This item's status can no longer be changed.", 409);
  return ok({ payment: result.payment });
}
