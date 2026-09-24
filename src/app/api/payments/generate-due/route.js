import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { generateDueInstallments } from "@/lib/payment";

// POST /api/payments/generate-due -- spec §2.3: auto-generate the next
// PENDING installment for every active REGULAR beneficiary that doesn't
// already have one scheduled. Manually triggered for now (no job scheduler
// in this codebase yet); wire this into a cron job once one exists.
export async function POST(request) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const created = await generateDueInstallments(mosque.id, user.id);
  return ok({ created, count: created.length });
}
