import { ok } from "@/lib/apiResponse";
import { TOKEN_COOKIE } from "@/lib/auth";

// POST /api/auth/logout -- clear the session cookie.
export async function POST() {
  const res = ok({ message: "Logged out." });
  res.cookies.set(TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
