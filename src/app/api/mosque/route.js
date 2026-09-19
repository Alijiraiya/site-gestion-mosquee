import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

// GET /api/mosque -- current user's mosque details.
// (Also available embedded in GET /api/auth, but exposed standalone for
// the Settings > Mosquée tab to load/save independently.)
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const fresh = await prisma.mosque.findUnique({ where: { id: mosque.id } });
  if (!fresh) return fail("Mosque not found.", 404);
  return ok({ mosque: fresh });
}

// PUT /api/mosque -- update the current user's mosque.
// Only the imam who owns the mosque can update it (enforced by getAuth
// resolving `mosque` from the authenticated user's own relation).
export async function PUT(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  const data = {};
  for (const f of ["name", "wilaya", "commune", "address", "phone", "email", "description"]) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  if (data.name !== undefined && !String(data.name).trim()) {
    return fail("Mosque name cannot be empty.");
  }
  if (data.email !== undefined && data.email !== null) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(String(data.email).trim())) {
      return fail("Invalid mosque email.");
    }
  }

  // Same identity guard as sign-up: renaming a mosque must not recreate the
  // duplicate we forbid at registration. Case-insensitive, unlike the
  // database index, which compares raw strings.
  if (
    data.name !== undefined ||
    data.wilaya !== undefined ||
    data.commune !== undefined
  ) {
    const nextName = String(data.name ?? mosque.name ?? "").trim();
    const nextWilaya = String(data.wilaya ?? mosque.wilaya ?? "").trim();
    const nextCommune = String(data.commune ?? mosque.commune ?? "").trim();
    if (nextName && nextWilaya && nextCommune) {
      const twin = await prisma.mosque.findFirst({
        where: {
          id: { not: mosque.id },
          name: { equals: nextName, mode: "insensitive" },
          wilaya: { equals: nextWilaya, mode: "insensitive" },
          commune: { equals: nextCommune, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (twin)
        return fail(
          "A mosque with this name already exists in this commune.",
          409,
        );
    }
  }

  try {
    const updated = await prisma.mosque.update({
      where: { id: mosque.id },
      data,
    });
    return ok({ mosque: updated });
  } catch (e) {
    if (e.code === "P2002") {
      const target = Array.isArray(e.meta?.target)
        ? e.meta.target.join(", ")
        : String(e.meta?.target ?? "");
      if (target.includes("name") || target.includes("commune"))
        return fail("A mosque with this name already exists in this commune.", 409);
      return fail("This email is already used by another mosque.", 409);
    }
    throw e;
  }
}