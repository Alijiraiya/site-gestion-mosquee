import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import {
  listMosquesForReview,
  requireAdminRole,
  MOSQUE_VERIFICATION_STATUSES,
} from "@/lib/admin";

// GET /api/admin/mosques -- moderation queue. ADMIN only.
// Query: ?status=PENDING|APPROVED|REJECTED (optional; omit for every mosque).
export async function GET(request) {
  const { user, error } = await getAuth(request);
  if (error) return error;
  if (!requireAdminRole(user))
    return fail("Administrator access required.", 403);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  if (status && !MOSQUE_VERIFICATION_STATUSES.includes(status))
    return fail(
      `Invalid status: ${status}. Expected one of ${MOSQUE_VERIFICATION_STATUSES.join(", ")}.`,
    );

  const mosques = await listMosquesForReview({ status });
  return ok({ mosques, count: mosques.length });
}
