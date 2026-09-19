import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import {
  getAuth,
  sanitizeUser,
  hashPassword,
  verifyPassword,
  signToken,
  TOKEN_COOKIE,
  TOKEN_MAX_AGE,
} from "@/lib/auth";

// GET /api/auth/ -- current user info.
export async function GET(request) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  return ok({ user: sanitizeUser(user), mosque });
}

// PUT /api/auth/ -- update the current user (and optionally the password).
// To change the password, the request must include both `password` (the new
// password) and `currentPassword` (verified against the stored hash) --
// otherwise anyone holding a valid session could silently change the password
// without knowing it, e.g. from an XSS-stolen token or a shared device.
export async function PUT(request) {
  const { user, error } = await getAuth(request);
  if (error) return error;
  const [body, err] = await readJson(request);
  if (err) return err;

  const data = {};
  for (const f of ["firstName", "lastName", "phone", "email"]) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  if (body.password) {
    if (!body.currentPassword) {
      return fail("currentPassword is required to change the password.");
    }
    const valid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!valid) return fail("Current password is incorrect.", 401);
    if (String(body.password).length < 8) {
      return fail("New password must be at least 8 characters.");
    }
    data.passwordHash = await hashPassword(body.password);
  }

  // "Log out other devices": bump tokenVersion so every token issued before
  // now (on any device, including this one) fails the check in getAuth().
  // We then reissue a fresh token for *this* request below so the device
  // that asked for this doesn't get logged out too.
  const logOutOtherDevices = body.logOutOtherDevices === true;
  if (logOutOtherDevices) {
    data.tokenVersion = { increment: 1 };
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      include: { mosque: true },
    });

    const payload = { user: sanitizeUser(updated), mosque: updated.mosque };

    if (logOutOtherDevices) {
      const token = signToken(updated);
      payload.token = token;
      const res = ok(payload);
      res.cookies.set(TOKEN_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: TOKEN_MAX_AGE,
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    }

    return ok(payload);
  } catch (e) {
    if (e.code === "P2002") return fail("Email already in use.", 409);
    throw e;
  }
}