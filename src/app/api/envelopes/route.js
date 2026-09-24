import { prisma } from "@/lib/prisma";
import { ok, created, fail, readJson, num } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import {
  validateEnvelopePayload,
  calculateEnvelopeMetrics,
  ENVELOPE_CATEGORIES,
  ENVELOPE_PERIODS,
  ENVELOPE_STATUSES,
} from "@/lib/envelopes";

export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("Aucune mosquée associée à ce compte.", 400);

  const { searchParams } = new URL(request.url);
  const where = { mosqueId: mosque.id };

  const status = searchParams.get("status");
  if (status && status !== "ALL" && ENVELOPE_STATUSES.includes(status)) {
    where.status = status;
  }

  const category = searchParams.get("category");
  if (category && category !== "ALL" && ENVELOPE_CATEGORIES.includes(category)) {
    where.category = category;
  }

  const period = searchParams.get("period");
  if (period && period !== "ALL" && ENVELOPE_PERIODS.includes(period)) {
    where.periodType = period;
  }

  const search = searchParams.get("search")?.trim();
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  // Fetch all envelopes matching the query
  const envelopes = await prisma.budgetEnvelope.findMany({
    where,
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" },
    ],
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
  });

  // Also fetch mosque-wide metrics across all envelopes for this mosque (unfiltered)
  const allMosqueEnvelopes = await prisma.budgetEnvelope.findMany({
    where: { mosqueId: mosque.id },
    select: {
      allocatedAmount: true,
      spentAmount: true,
      alertThreshold: true,
      status: true,
    },
  });

  let totalAllocated = 0;
  let totalSpent = 0;
  let warningCount = 0;
  let exhaustedCount = 0;
  let activeCount = 0;
  let closedCount = 0;

  for (const env of allMosqueEnvelopes) {
    const alloc = num(env.allocatedAmount) || 0;
    const spent = num(env.spentAmount) || 0;
    const threshold = env.alertThreshold || 80;

    if (env.status !== "CLOSED") {
      totalAllocated += alloc;
      totalSpent += spent;
    }

    if (env.status === "ACTIVE") activeCount++;
    if (env.status === "CLOSED") closedCount++;

    const m = calculateEnvelopeMetrics(alloc, spent, threshold);
    if (m.healthState === "WARNING" && env.status === "ACTIVE") warningCount++;
    if (m.healthState === "EXHAUSTED" || env.status === "EXHAUSTED") exhaustedCount++;
  }

  const totalRemaining = totalAllocated - totalSpent;

  // Enrich returned envelopes
  const enrichedEnvelopes = envelopes.map((env) => {
    const allocated = num(env.allocatedAmount);
    const spent = num(env.spentAmount);
    const metrics = calculateEnvelopeMetrics(allocated, spent, env.alertThreshold);

    return {
      ...env,
      allocatedAmount: allocated,
      spentAmount: spent,
      metrics,
    };
  });

  return ok({
    summary: {
      totalAllocated,
      totalSpent,
      totalRemaining,
      warningCount,
      exhaustedCount,
      activeCount,
      closedCount,
      totalCount: allMosqueEnvelopes.length,
    },
    envelopes: enrichedEnvelopes,
  });
}

export async function POST(request) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("Aucune mosquée associée à ce compte.", 400);

  const [body, err] = await readJson(request);
  if (err) return err;

  const { isValid, errors } = validateEnvelopePayload(body, { isUpdate: false });
  if (!isValid) {
    return fail("Données d'enveloppe invalides.", 400, { errors });
  }

  // Check name uniqueness among active/draft envelopes in this mosque
  const trimmedName = body.name.trim();
  const existing = await prisma.budgetEnvelope.findFirst({
    where: {
      mosqueId: mosque.id,
      name: { equals: trimmedName, mode: "insensitive" },
      status: { in: ["ACTIVE", "DRAFT", "EXHAUSTED"] },
    },
  });

  if (existing) {
    return fail("Une enveloppe active portant ce nom existe déjà.", 409, {
      errors: { name: "Une enveloppe active portant ce nom existe déjà." },
    });
  }

  const envelope = await prisma.budgetEnvelope.create({
    data: {
      mosqueId: mosque.id,
      createdById: user.id,
      name: trimmedName,
      category: body.category,
      periodType: body.periodType,
      allocatedAmount: body.allocatedAmount,
      spentAmount: body.spentAmount ? Number(body.spentAmount) : 0,
      alertThreshold: body.alertThreshold !== undefined ? Number(body.alertThreshold) : 80,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      status: body.status || "ACTIVE",
      description: body.description?.trim() || null,
      color: body.color || null,
    },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
  });

  const allocated = num(envelope.allocatedAmount);
  const spent = num(envelope.spentAmount);
  const metrics = calculateEnvelopeMetrics(allocated, spent, envelope.alertThreshold);

  return created({
    ...envelope,
    allocatedAmount: allocated,
    spentAmount: spent,
    metrics,
  });
}
