import { NextResponse } from "next/server";

// Standard success envelope: { success: true, data }
export function ok(data, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created(data) {
  return ok(data, 201);
}

// Standard error envelope: { success: false, message, ...extra }
export function fail(message, status = 400, extra = {}) {
  return NextResponse.json({ success: false, message, ...extra }, { status });
}

// Safely parse a JSON request body; returns [body, null] or [null, errorResponse].
export async function readJson(request) {
  try {
    const body = await request.json();
    return [body ?? {}, null];
  } catch {
    return [null, fail("Invalid or missing JSON body.")];
  }
}

// Convert Prisma Decimal / string numerics to plain numbers.
export function num(v) {
  if (v === null || v === undefined) return v;
  return typeof v === "number" ? v : Number(v);
}
