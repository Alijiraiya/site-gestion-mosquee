import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { rejectMosque, requireAdminRole } from "@/lib/admin";

// POST /api/admin/mosques/:id/reject -- ADMIN only.
export async function POST(request, { params }) {
  const { user, error } = await getAuth(request);
  if (error) return error;
  if (!requireAdminRole(user))
    return fail("Administrator access required.", 403);

  const { id } = await params;
  const mosque = await rejectMosque(id);
  if (!mosque) return fail("Mosque not found.", 404);

  return ok({ mosque });
}
