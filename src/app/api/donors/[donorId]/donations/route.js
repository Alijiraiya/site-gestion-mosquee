import { prisma } from "@/lib/prisma";
import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

// GET /api/donors/:donorId/donations -- donations made by a donor.
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { donorId } = await params;
  const donor = await prisma.donor.findFirst({
    where: { id: donorId, mosqueId: mosque?.id },
  });
  if (!donor) return fail("Donor not found.", 404);
  const donations = await prisma.donation.findMany({
    where: { donorId, mosqueId: mosque.id },
    orderBy: { receivedAt: "desc" },
  });
  return ok({ donations, count: donations.length });
}

// POST /api/donors/:donorId/donations -- create a donation linked to a donor.
export async function POST(request, { params }) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  const { donorId } = await params;
  const donor = await prisma.donor.findFirst({
    where: { id: donorId, mosqueId: mosque?.id },
  });
  if (!donor)
    return fail("Donor not found. The donor must exist in the database.", 404);

  const [body, err] = await readJson(request);
  if (err) return err;
  const amount = Number(body.amount);
  if (!(amount > 0)) return fail("A positive amount is required.");
  if (!body.category)
    return fail("category is required (e.g. ZAKAT_MAL, SADAQAH).");
  if (!body.paymentMethod)
    return fail("paymentMethod is required (CASH, CCP, BANK_TRANSFER).");

  const donation = await prisma.$transaction(async (tx) => {
    const d = await tx.donation.create({
      data: {
        mosqueId: mosque.id,
        donorId,
        isAnonymous: false,
        amount,
        category: body.category,
        paymentMethod: body.paymentMethod,
        notes: body.notes ?? null,
        createdById: user.id,
        receivedAt: new Date(body.receivedAt ?? new Date()),
      },
    });
    await tx.mosque.update({
      where: { id: mosque.id },
      data: { balance: { increment: amount } },
    });
    await tx.donor.update({
      where: { id: donorId },
      data: { totalDonated: { increment: amount } },
    });
    return d;
  });
  return created({ donation });
}