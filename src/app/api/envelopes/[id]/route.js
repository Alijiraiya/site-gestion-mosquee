import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, num } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import {
  validateEnvelopePayload,
  calculateEnvelopeMetrics,
  canTransitionStatus,
} from "@/lib/envelopes";

// GET /api/envelopes/:id
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("Aucune mosquée associée à ce compte.", 400);

  const { id } = await params;
  const envelope = await prisma.budgetEnvelope.findFirst({
    where: { id, mosqueId: mosque.id },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
      transfersSent: {
        include: { destEnvelope: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      transfersReceived: {
        include: { sourceEnvelope: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!envelope) {
    return fail("Enveloppe introuvable.", 404);
  }

  const allocated = num(envelope.allocatedAmount);
  const spent = num(envelope.spentAmount);
  const metrics = calculateEnvelopeMetrics(allocated, spent, envelope.alertThreshold);

  return ok({
    envelope: {
      ...envelope,
      allocatedAmount: allocated,
      spentAmount: spent,
      metrics,
    },
  });
}

// PUT /api/envelopes/:id
export async function PUT(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("Aucune mosquée associée à ce compte.", 400);

  const { id } = await params;
  const existing = await prisma.budgetEnvelope.findFirst({
    where: { id, mosqueId: mosque.id },
  });

  if (!existing) {
    return fail("Enveloppe introuvable.", 404);
  }

  const [body, err] = await readJson(request);
  if (err) return err;

  const { isValid, errors } = validateEnvelopePayload(body, { isUpdate: true });
  if (!isValid) {
    return fail("Données d'enveloppe invalides.", 400, { errors });
  }

  // Status transition validation
  if (body.status && body.status !== existing.status) {
    if (!canTransitionStatus(existing.status, body.status)) {
      return fail(
        `Transition de statut non autorisée depuis ${existing.status} vers ${body.status}.`,
        400
      );
    }
  }

  // Name uniqueness check if renamed
  if (body.name && body.name.trim() !== existing.name) {
    const trimmed = body.name.trim();
    const conflict = await prisma.budgetEnvelope.findFirst({
      where: {
        mosqueId: mosque.id,
        name: { equals: trimmed, mode: "insensitive" },
        id: { not: id },
        status: { in: ["ACTIVE", "DRAFT", "EXHAUSTED"] },
      },
    });
    if (conflict) {
      return fail("Une autre enveloppe active porte déjà ce nom.", 409, {
        errors: { name: "Une autre enveloppe active porte déjà ce nom." },
      });
    }
  }

  const updateData = {};
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.category !== undefined) updateData.category = body.category;
  if (body.periodType !== undefined) updateData.periodType = body.periodType;
  if (body.allocatedAmount !== undefined) updateData.allocatedAmount = body.allocatedAmount;
  if (body.spentAmount !== undefined) updateData.spentAmount = Number(body.spentAmount);
  if (body.alertThreshold !== undefined) updateData.alertThreshold = Number(body.alertThreshold);
  if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
  if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate);
  if (body.status !== undefined) updateData.status = body.status;
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.color !== undefined) updateData.color = body.color || null;

  const updated = await prisma.budgetEnvelope.update({
    where: { id },
    data: updateData,
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
  });

  const allocated = num(updated.allocatedAmount);
  const spent = num(updated.spentAmount);
  const metrics = calculateEnvelopeMetrics(allocated, spent, updated.alertThreshold);

  return ok({
    ...updated,
    allocatedAmount: allocated,
    spentAmount: spent,
    metrics,
  });
}

// DELETE /api/envelopes/:id
export async function DELETE(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("Aucune mosquée associée à ce compte.", 400);

  const { id } = await params;
  const existing = await prisma.budgetEnvelope.findFirst({
    where: { id, mosqueId: mosque.id },
    include: {
      transfersSent: { select: { id: true } },
      transfersReceived: { select: { id: true } },
    },
  });

  if (!existing) {
    return fail("Enveloppe introuvable.", 404);
  }

  const hasSpent = num(existing.spentAmount) > 0;
  const hasTransfers = existing.transfersSent.length > 0 || existing.transfersReceived.length > 0;

  // Protect financial history: soft-close if transactions exist
  if (hasSpent || hasTransfers) {
    const updated = await prisma.budgetEnvelope.update({
      where: { id },
      data: { status: "CLOSED" },
    });
    return ok({
      message: "L'enveloppe contient des dépenses ou transferts. Elle a été clôturée.",
      envelope: updated,
      closed: true,
    });
  }

  await prisma.budgetEnvelope.delete({
    where: { id },
  });

  return ok({
    message: "Enveloppe supprimée avec succès.",
    deleted: true,
  });
}
