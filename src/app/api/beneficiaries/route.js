import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import {
  listBeneficiaries,
  createBeneficiary,
  validateBeneficiaryInput,
  BENEFICIARY_ROLES,
  BENEFICIARY_PAYMENT_TYPES,
} from "@/lib/beneficiary";

// GET /api/beneficiaries -- directory listing (spec §2.1).
// Query: ?role=&paymentType=&isActive=true|false&search=
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  if (role && !BENEFICIARY_ROLES.includes(role))
    return fail(`Invalid role: ${role}. Expected one of ${BENEFICIARY_ROLES.join(", ")}.`);
  const paymentType = searchParams.get("paymentType");
  if (paymentType && !BENEFICIARY_PAYMENT_TYPES.includes(paymentType))
    return fail(
      `Invalid paymentType: ${paymentType}. Expected one of ${BENEFICIARY_PAYMENT_TYPES.join(", ")}.`,
    );
  const isActiveParam = searchParams.get("isActive");
  const isActive =
    isActiveParam === null ? undefined : isActiveParam === "true";
  const search = searchParams.get("search") || undefined;

  const beneficiaries = await listBeneficiaries(mosque.id, {
    role,
    paymentType,
    isActive,
    search,
  });
  return ok({ beneficiaries, count: beneficiaries.length });
}

// POST /api/beneficiaries -- create a beneficiary. Also used as the "Ajout
// rapide si nouveau" flow from the expense form's auto-completion (spec §1.1).
export async function POST(request) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  const [data, validationError] = validateBeneficiaryInput(body);
  if (validationError) return fail(validationError);

  const beneficiary = await createBeneficiary(mosque.id, user.id, data);
  return created({ beneficiary });
}
