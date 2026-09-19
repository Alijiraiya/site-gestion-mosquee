import { prisma } from "@/lib/prisma";
import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { enumField, requiredText } from "@/lib/validate";

// Donor.donorType is a Postgres enum. Anything else has to be rejected here:
// forwarding raw text to Prisma produced an empty HTTP 500 with no message.
const DONOR_TYPES = ["INDIVIDUAL", "ORGANIZATION"];

// GET /api/donors -- list donors for the current mosque (search supported).
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const { searchParams } = new URL(request.url);
  const search = (
    searchParams.get("search") ||
    searchParams.get("q") ||
    ""
  ).trim();
  const where = { mosqueId: mosque.id };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  const donorType = searchParams.get("donorType");
  if (donorType) {
    const [value, msg] = enumField(donorType, "donorType", DONOR_TYPES);
    if (msg) return fail(msg);
    where.donorType = value;
  }

  const donors = await prisma.donor.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return ok({ donors, count: donors.length });
}

// POST /api/donors -- register a new donor.
export async function POST(request) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  const [name, nameMsg] = requiredText(body.name, "Donor name", {
    maxLength: 200,
  });
  if (nameMsg) return fail("Donor name is required.");

  const phone = body.phone ? String(body.phone).trim() : null;
  const email = body.email ? String(body.email).trim() : null;

  const [donorType, typeMsg] = enumField(
    body.donorType ?? "INDIVIDUAL",
    "donorType",
    DONOR_TYPES,
  );
  if (typeMsg) return fail(typeMsg);

  // Duplicate guard: same mosque + same name, and matching phone OR email
  // when at least one of those was provided. A bare name match alone isn't
  // enough (many donors can share a common name), but name + a real contact
  // detail matching is a strong signal of an accidental re-entry.
  if (phone || email) {
    const dup = await prisma.donor.findFirst({
      where: {
        mosqueId: mosque.id,
        name: { equals: name, mode: "insensitive" },
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email: { equals: email, mode: "insensitive" } }] : []),
        ],
      },
      select: { id: true },
    });
    if (dup) {
      return fail(
        "A donor with this name and contact info already exists.",
        409,
        { donorId: dup.id },
      );
    }
  }

  const donor = await prisma.donor.create({
    data: {
      mosqueId: mosque.id,
      name,
      phone,
      email,
      address: body.address ?? null,
      donorType,
      notes: body.notes ?? null,
      createdById: user.id,
    },
  });
  return created({ donor });
}
