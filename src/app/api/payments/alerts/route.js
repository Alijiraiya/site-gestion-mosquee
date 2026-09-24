import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { getPaymentAlerts } from "@/lib/payment";

// GET /api/payments/alerts -- spec §2.3: "Rappel J-3" (upcoming) and
// "Non-paiement J+1" (late) alerts. Data only -- no push notification is
// sent yet (that's Serine 1's notifications.js); Serine 2's dashboard or a
// future notification job can poll this.
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const alerts = await getPaymentAlerts(mosque.id);
  return ok(alerts);
}
