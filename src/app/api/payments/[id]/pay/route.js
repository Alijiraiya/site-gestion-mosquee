import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { setPaymentStatus } from "@/lib/payment";

// POST /api/payments/:id/pay -- settle a PENDING installment.
// Body (optional): { paidAt } to backdate the disbursement date; defaults
// to now. The body itself is optional, so this doesn't use readJson (which
// treats a missing/empty body as an error).
export async function POST(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  let paidAt;
  if (body?.paidAt) {
    const d = new Date(body.paidAt);
    if (isNaN(d.getTime())) return fail("paidAt is not a valid date.");
    paidAt = d;
  }

  const { id } = await params;
  const result = await setPaymentStatus(mosque.id, id, "PAID", { paidAt });
  if (result.error === "NOT_FOUND") return fail("Payment not found.", 404);
  if (result.error === "LOCKED") return fail("This item's status can no longer be changed.", 409);
  return ok({ payment: result.payment });
}
