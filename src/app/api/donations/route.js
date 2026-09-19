import { prisma } from "@/lib/prisma";
import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

// Categories accepted by the app. KAFFARA was removed: it is no longer
// offered anywhere in the interface, so it is no longer accepted here either.
// The Prisma enum is left untouched, so donations recorded before the removal
// stay readable (no migration, no data loss).
const CATEGORIES = ["ZAKAT_MAL", "ZAKAT_FITR", "SADAQAH", "OTHER"];
const PAYMENT_METHODS = ["CASH", "CCP", "BANK_TRANSFER"];

// GET /api/donations -- list donations (light fields usable as filters).
export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const { searchParams } = new URL(request.url);
  const where = { mosqueId: mosque.id };
  const category = searchParams.get("category");
  if (category) where.category = category;
  const paymentMethod = searchParams.get("paymentMethod");
  if (paymentMethod) where.paymentMethod = paymentMethod;
  const donorId = searchParams.get("donorId");
  if (donorId) where.donorId = donorId;
  // Guard against invalid date strings: `new Date("abc")` produced an Invalid
  // Date which Prisma rejected with a 500 instead of just ignoring the filter.
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) {
    const range = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) range.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) range.lte = d;
    }
    if (Object.keys(range).length) where.receivedAt = range;
  }

  const donations = await prisma.donation.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      amount: true,
      category: true,
      paymentMethod: true,
      receivedAt: true,
      isAnonymous: true,
      donorId: true,
      donor: { select: { name: true } },
    },
  });
  return ok({ donations, count: donations.length });
}

// POST /api/donations -- create a donation (anonymous, or linked via donorId).
// (The spec also exposes POST /api/donors/:donorId/donations for donor-linked
// donations; this route additionally supports anonymous donations.)
export async function POST(request) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  const amount = Number(body.amount);
  if (!(amount > 0)) return fail("A positive amount is required.");
  if (!body.category)
    return fail("category is required (e.g. ZAKAT_MAL, SADAQAH).");
  // Validate against the Prisma enums up front. Without this, a typo in the
  // payload surfaced as an unhandled Prisma error and a bare 500.
  if (!CATEGORIES.includes(body.category))
    return fail(
      `Invalid category: ${body.category}. Expected one of ${CATEGORIES.join(", ")}.`,
    );
  if (!body.paymentMethod)
    return fail("paymentMethod is required (CASH, CCP, BANK_TRANSFER).");
  if (!PAYMENT_METHODS.includes(body.paymentMethod))
    return fail(
      `Invalid paymentMethod: ${body.paymentMethod}. Expected one of ${PAYMENT_METHODS.join(", ")}.`,
    );
  if (body.receivedAt !== undefined && isNaN(new Date(body.receivedAt).getTime()))
    return fail("receivedAt is not a valid date.");

  const isAnonymous = body.isAnonymous === true || !body.donorId;
  let donorId = null;
  if (isAnonymous) {
    // Respect the mosque's "Autoriser les dons anonymes" setting -- this was
    // persisted by the Settings page but never actually checked here.
    const settings = await prisma.mosqueSettings.findUnique({
      where: { mosqueId: mosque.id },
    });
    if (settings && settings.allowAnonymousDonations === false) {
      // Message kept in English like every other API error in this codebase
      // -- the API isn't localized. `code` lets the frontend show a
      // translated toast (see donationsValidation.anonymousDisabledError in
      // fr.json / ar.json) once a donation-creation form calls this route.
      return fail(
        "Anonymous donations are disabled for this mosque. Please select a donor.",
        403,
        { code: "ANONYMOUS_DONATIONS_DISABLED" },
      );
    }
  } else {
    const donor = await prisma.donor.findFirst({
      where: { id: body.donorId, mosqueId: mosque.id },
    });
    if (!donor) return fail("Donor not found.", 404);
    donorId = donor.id;
  }

  const donation = await prisma.$transaction(async (tx) => {
    const d = await tx.donation.create({
      data: {
        mosqueId: mosque.id,
        donorId,
        isAnonymous,
        amount,
        category: body.category,
        paymentMethod: body.paymentMethod,
        notes: body.notes ?? null,
        receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
        createdById: user.id,
      },
    });
    if (donorId)
      await tx.donor.update({
        where: { id: donorId },
        data: { totalDonated: { increment: amount } },
      });
    await tx.mosque.update({
      where: { id: mosque.id },
      data: { balance: { increment: amount } },
    });
    return d;
  });
  return created({ donation });
}