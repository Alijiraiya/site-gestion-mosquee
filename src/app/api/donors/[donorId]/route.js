import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

async function owned(mosqueId, id) {
  return prisma.donor.findFirst({ where: { id, mosqueId } });
}

// GET /api/donors/:id -- single donor (with recent donations).
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { donorId } = await params;
  const donor = await prisma.donor.findFirst({
    where: { id: donorId, mosqueId: mosque?.id },
    include: { donations: { orderBy: { receivedAt: "desc" }, take: 20 } },
  });
  if (!donor) return fail("Donor not found.", 404);
  return ok({ donor });
}

// PUT /api/donors/:id -- update donor info.
export async function PUT(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { donorId } = await params;
  const existing = await owned(mosque?.id, donorId);
  if (!existing) return fail("Donor not found.", 404);
  const [body, err] = await readJson(request);
  if (err) return err;

  const data = {};
  for (const f of ["name", "phone", "email", "address", "donorType", "notes"]) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  const donor = await prisma.donor.update({ where: { id: donorId }, data });
  return ok({ donor });
}

// DELETE /api/donors/:id -- remove a donor.
// NOTE: the current schema has no soft-delete flag on Donor. Deleting a donor
// that has donations would break traceable history, so this is blocked when
// donations exist. Add an `isActive` boolean to Donor to support soft delete.
export async function DELETE(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  const { donorId } = await params;
  const existing = await owned(mosque?.id, donorId);
  if (!existing) return fail("Donor not found.", 404);

  const count = await prisma.donation.count({ where: { donorId: donorId } });
  if (count > 0) {
    return fail(
      `This donor has ${count} linked donation(s). The current schema has no soft-delete flag on Donor, so deleting would break donation history. Add an 'isActive' field to Donor to support soft delete.`,
      409,
    );
  }
  await prisma.donor.delete({ where: { id: donorId } });
  return ok({ message: "Donor deleted." });
}