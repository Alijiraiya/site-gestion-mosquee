import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

// NOTE: this file previously contained a verbatim copy of the collection
// handlers from /api/donations (a GET list + a POST create). That meant
// `GET /api/donations/:id` returned the whole list, `PUT` did not exist, and
// `DELETE /api/donations/:id` silently 405'd - so a mistyped donation could
// never be corrected and the mosque balance stayed wrong forever.

// KAFFARA was removed from the app (see /api/donations). The Prisma enum is
// unchanged, so an old donation can still be read and re-saved under one of
// the remaining categories.
const CATEGORIES = ["ZAKAT_MAL", "ZAKAT_FITR", "SADAQAH", "OTHER"];
const PAYMENT_METHODS = ["CASH", "CCP", "BANK_TRANSFER"];

async function owned(mosqueId, id) {
  if (!mosqueId) return null;
  return prisma.donation.findFirst({ where: { id, mosqueId } });
}

// GET /api/donations/:id -- a single donation with its donor.
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { id } = await params;

  const donation = await prisma.donation.findFirst({
    where: { id, mosqueId: mosque?.id },
    include: {
      donor: { select: { id: true, name: true, phone: true, email: true } },
    },
  });
  if (!donation) return fail("Donation not found.", 404);
  return ok({ donation });
}

// PUT /api/donations/:id -- correct a donation.
// Keeps the mosque balance and the donor's totalDonated consistent by undoing
// the old amount and applying the new one inside a single transaction.
export async function PUT(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { id } = await params;

  const existing = await owned(mosque?.id, id);
  if (!existing) return fail("Donation not found.", 404);

  const [body, err] = await readJson(request);
  if (err) return err;

  const data = {};

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!(amount > 0)) return fail("A positive amount is required.");
    data.amount = amount;
  }
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category))
      return fail(`Invalid category: ${body.category}`);
    data.category = body.category;
  }
  if (body.paymentMethod !== undefined) {
    if (!PAYMENT_METHODS.includes(body.paymentMethod))
      return fail(`Invalid paymentMethod: ${body.paymentMethod}`);
    data.paymentMethod = body.paymentMethod;
  }
  if (body.notes !== undefined) data.notes = body.notes ?? null;
  if (body.receivedAt !== undefined) {
    const d = new Date(body.receivedAt);
    if (isNaN(d.getTime())) return fail("receivedAt is not a valid date.");
    data.receivedAt = d;
  }

  // Re-assigning the donor (or making the donation anonymous).
  let newDonorId = existing.donorId;
  if (body.donorId !== undefined || body.isAnonymous !== undefined) {
    const anonymous = body.isAnonymous === true || body.donorId === null;
    if (anonymous) {
      newDonorId = null;
    } else if (body.donorId) {
      const donor = await prisma.donor.findFirst({
        where: { id: body.donorId, mosqueId: mosque.id },
        select: { id: true },
      });
      if (!donor) return fail("Donor not found.", 404);
      newDonorId = donor.id;
    }
    data.donorId = newDonorId;
    data.isAnonymous = newDonorId === null;
  }

  if (Object.keys(data).length === 0)
    return fail("No updatable field was provided.");

  const oldAmount = Number(existing.amount);
  const newAmount = data.amount ?? oldAmount;
  const delta = newAmount - oldAmount;

  const donation = await prisma.$transaction(async (tx) => {
    const updated = await tx.donation.update({ where: { id }, data });

    if (delta !== 0) {
      await tx.mosque.update({
        where: { id: mosque.id },
        data: { balance: { increment: delta } },
      });
    }

    // Keep donor totals correct across amount changes AND donor re-assignment.
    if (existing.donorId && existing.donorId === newDonorId) {
      if (delta !== 0)
        await tx.donor.update({
          where: { id: existing.donorId },
          data: { totalDonated: { increment: delta } },
        });
    } else {
      if (existing.donorId)
        await tx.donor.update({
          where: { id: existing.donorId },
          data: { totalDonated: { decrement: oldAmount } },
        });
      if (newDonorId)
        await tx.donor.update({
          where: { id: newDonorId },
          data: { totalDonated: { increment: newAmount } },
        });
    }

    return updated;
  });

  return ok({ donation });
}

// DELETE /api/donations/:id -- remove a donation and roll back the balance.
export async function DELETE(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { id } = await params;

  const existing = await owned(mosque?.id, id);
  if (!existing) return fail("Donation not found.", 404);

  const amount = Number(existing.amount);

  const fresh = await prisma.mosque.findUnique({
    where: { id: mosque.id },
    select: { balance: true },
  });
  if (Number(fresh.balance) < amount) {
    return fail(
      `Cannot delete: the money has already been distributed. Current balance ${Number(fresh.balance)} is lower than the donation amount ${amount}.`,
      422,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.donation.delete({ where: { id } });
    await tx.mosque.update({
      where: { id: mosque.id },
      data: { balance: { decrement: amount } },
    });
    if (existing.donorId) {
      await tx.donor.update({
        where: { id: existing.donorId },
        data: { totalDonated: { decrement: amount } },
      });
    }
  });

  return ok({ message: "Donation deleted and balance updated." });
}
