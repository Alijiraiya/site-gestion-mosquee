import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import {
  verifyPassword,
  signToken,
  sanitizeUser,
  TOKEN_COOKIE,
  TOKEN_MAX_AGE,
} from "@/lib/auth";

const MAX_LOCATION_LENGTH = 120;

function locationValue(value) {
  return String(value ?? "").trim().slice(0, MAX_LOCATION_LENGTH);
}

// GET /api/auth/login -- return the options needed by the location-based login form.
// A mosque ID, rather than its name, is used when signing in to avoid ambiguity
// where two mosques share a name.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const wilaya = locationValue(searchParams.get("wilaya"));
    const commune = locationValue(searchParams.get("commune"));

    if (!wilaya) {
      const mosques = await prisma.mosque.findMany({
        select: { wilaya: true },
        distinct: ["wilaya"],
        orderBy: { wilaya: "asc" },
      });
      return ok({ wilayas: mosques.map(({ wilaya: value }) => value).filter(Boolean) });
    }

    if (!commune) {
      const mosques = await prisma.mosque.findMany({
        where: { wilaya },
        select: { commune: true },
        distinct: ["commune"],
        orderBy: { commune: "asc" },
      });
      return ok({ communes: mosques.map(({ commune: value }) => value).filter(Boolean) });
    }

    const mosques = await prisma.mosque.findMany({
      where: { wilaya, commune },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return ok({ mosques });
  } catch (e) {
    console.error("Login options error:", e);
    return fail("Unable to load mosque options.", 500);
  }
}

// POST /api/auth/login -- authenticate and start a session.
export async function POST(request) {
  try {
    const [body, err] = await readJson(request);
    if (err) return err;
    const mosqueId = String(body.mosqueId ?? "").trim();
    const { password } = body;
    if (!mosqueId || !password)
      return fail("Mosque and password are required.");

    const mosque = await prisma.mosque.findUnique({
      where: { id: mosqueId },
      include: { imam: true },
    });
    const user = mosque?.imam;
    if (!user) return fail("Invalid credentials.", 401);

    if (!user.passwordHash) return fail("Invalid credentials.", 401); // guard: no throw on bad hash

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return fail("Invalid credentials.", 401);

    if (user.isActive === false)
      return fail("This account is not active yet.", 403);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = signToken(user);
    // Never return the included imam relation: it contains passwordHash.
    const { imam: _imam, ...safeMosque } = mosque;
    const res = ok({ user: sanitizeUser(user), mosque: safeMosque, token });
    res.cookies.set(TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: TOKEN_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (e) {
    console.error("Login error:", e); // check your terminal — this will show the real cause
    return fail("An unexpected error occurred. Please try again.", 500);
  }
}
