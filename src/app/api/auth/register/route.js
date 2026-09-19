import { prisma } from "@/lib/prisma";
import { created, fail, readJson } from "@/lib/apiResponse";
import {
  hashPassword,
  signToken,
  sanitizeUser,
  TOKEN_COOKIE,
  TOKEN_MAX_AGE,
} from "@/lib/auth";
import { requiredText } from "@/lib/validate";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mosque columns that are NOT NULL in the schema. Sending "" used to be
// accepted, and the mosque profile page then showed an account whose wilaya
// and commune were blank -- with no way to tell a real empty value from a
// forgotten field.
const MOSQUE_REQUIRED = ["name", "wilaya", "commune", "address"];

// POST /api/auth/register -- create a new imam user (and optionally a mosque)
export async function POST(request) {
  const [body, err] = await readJson(request);
  if (err) return err;

  const { firstName, lastName, email, password, phone, mosque } = body;
  if (!firstName || !lastName || !email || !password || !mosque || (mosque && typeof mosque === "object" && (!mosque.name || !mosque.wilaya || !mosque.commune || !mosque.address)))
    return fail("Missing required registration fields.");

  // validate unicity of mosque name in the same wilaya/commune/address combination
  const existingMosque = await prisma.mosque.findFirst({
    where: {
      name: String(mosque.name).trim(),
      wilaya: String(mosque.wilaya).trim(),
      commune: String(mosque.commune).trim(),
    },
  }
  )
  if (existingMosque) {
    return fail("A mosque with this name already exists in the same wilaya and commune.", 409);
  }


  for (const [value, label] of [
    [firstName, "firstName"],
    [lastName, "lastName"],
  ]) {
    const [, msg] = requiredText(value, label, { maxLength: 120 });
    if (msg) return fail(msg);
  }

  const trimmedEmail = String(email).trim().toLowerCase();

  if (!EMAIL_RE.test(trimmedEmail))
    return fail("Please enter a valid email address.");
  if (String(password).length < 8)
    return fail("Password must be at least 8 characters long.");

  // A mosque block is optional, but a PARTIAL one is not: creating an account
  // with a mosque that has no wilaya/commune/address produced a profile the
  // imam could never complete from the sign-up flow.
  const wantsMosque = Boolean(mosque && mosque.name);
  if (mosque !== undefined && mosque !== null && typeof mosque !== "object")
    return fail("mosque must be an object.");
  if (wantsMosque) {
    for (const f of MOSQUE_REQUIRED) {
      const [, msg] = requiredText(mosque[f], `mosque.${f}`, {
        maxLength: 200,
      });
      if (msg) return fail(msg);
    }
    if (mosque.email && !EMAIL_RE.test(String(mosque.email).trim().toLowerCase()))
      return fail("Please enter a valid mosque email address.");
  }

  // ensure email isn't already taken
  const existing = await prisma.user.findUnique({
    where: { email: trimmedEmail },
  });
  if (existing) return fail("Email already in use.", 409);

  const passwordHash = await hashPassword(password);

  // Mosque.email is @unique and NOT NULL. Creating a mosque with an empty
  // string worked for the very first signup and then collided on every later
  // one, so fall back to the imam's email and reject duplicates up front.
  const mosqueEmail = wantsMosque
    ? String(mosque.email || trimmedEmail)
        .trim()
        .toLowerCase()
    : null;

  if (wantsMosque) {
    const takenMosque = await prisma.mosque.findUnique({
      where: { email: mosqueEmail },
      select: { id: true },
    });
    if (takenMosque)
      return fail("A mosque is already registered with this email.", 409);
  }

  try {
    // User + mosque must be created atomically. Previously the mosque was
    // created in a second, separate call: if that failed (duplicate email,
    // missing field, ...) the imam account was left behind with no mosque and
    // every later API call answered "No mosque is linked to this account."
    const createdUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          email: trimmedEmail,
          phone: phone ? String(phone) : null,
          passwordHash,
          role: "IMAM",
          // For now activate newly created users so they can sign in immediately.
          isActive: true,
        },
      });

      if (wantsMosque) {
        const createdMosque = await tx.mosque.create({
          data: {
            name: String(mosque.name).trim(),
            wilaya: String(mosque.wilaya).trim(),
            commune: String(mosque.commune).trim(),
            address: String(mosque.address).trim(),
            phone: mosque.phone ? String(mosque.phone).trim() : "",
            email: mosqueEmail,
            imamId: u.id,
          },
        });

        // Create the settings row right away so /api/settings, SVF scoring and
        // the distribution simulator never lazily create it mid-request.
        await tx.mosqueSettings.create({ data: { mosqueId: createdMosque.id } });

        u.mosque = createdMosque;
      } else {
        u.mosque = null;
      }

      return u;
    });

    const token = signToken(createdUser);
    // 201, not 200: this request created two rows. The previous 200 made the
    // sign-up response indistinguishable from a plain login.
    const res = created({
      user: sanitizeUser(createdUser),
      mosque: createdUser.mosque ?? null,
      token,
    });

    res.cookies.set(TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: TOKEN_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (e) {
    if (e.code === "P2002") {
      const target = Array.isArray(e.meta?.target)
        ? e.meta.target.join(", ")
        : String(e.meta?.target ?? "");
      if (target.toLowerCase().includes("mosque"))
        return fail("A mosque with these details already exists.", 409);
      return fail("Email already in use.", 409);
    }
    // Log the FULL error server-side, and echo the useful parts to the client
    // outside production. Swallowing this behind a generic message made the
    // 500 impossible to diagnose from the response alone.
    console.error("Register error:", e);
    if (process.env.NODE_ENV !== "production") {
      return fail(
        "Registration failed: " +
          (e.code ? "[" + e.code + "] " : "") +
          String(e.message).split("\n").slice(0, 4).join(" ").slice(0, 600),
        500,
        { code: e.code ?? null, meta: e.meta ?? null },
      );
    }
    return fail("An unexpected error occurred during registration.", 500);
  }
}