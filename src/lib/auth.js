import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {prisma} from "@/lib/prisma";
import { fail } from "@/lib/apiResponse";

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const TOKEN_COOKIE = "token";
export const TOKEN_MAX_AGE = TOKEN_TTL_SECONDS;

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), 10);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(plain), hash);
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_SECONDS },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function getToken(request) {
  const header = request.headers.get("authorization");
  if (header && header.startsWith("Bearer ")) return header.slice(7);
  try {
    const c = request.cookies?.get?.(TOKEN_COOKIE);
    if (c?.value) return c.value;
  } catch {
    // request may not expose cookies in some runtimes
  }
  return null;
}

// Resolve the authenticated user + their mosque from the request.
// Returns { user, mosque } on success, or { error: NextResponse } on failure.
export async function getAuth(request) {
  const token = getToken(request);
  if (!token) return { error: fail("Authentication required.", 401) };

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return { error: fail("Invalid or expired session.", 401) };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { mosque: true },
  });
  if (!user) return { error: fail("User no longer exists.", 401) };

  // If "log out other devices" was triggered since this token was issued,
  // tokenVersion will have been bumped and every older token -- including
  // this one, if it's one of the "other" devices -- is rejected here.
  if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
    return { error: fail("Session has been logged out on this device.", 401) };
  }

  return { user, mosque: user.mosque };
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}