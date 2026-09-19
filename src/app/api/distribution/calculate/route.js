import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { calculateWaterFilling } from "@/lib/waterFilling";

// POST /api/distribution/calculate -- preview a Water-Filling allocation.
// Does NOT write anything or touch the mosque balance.
// Body: { budget, familyIds?, reserve?, minAmt?, maxAmt? }
export async function POST(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  const budget = Number(body.budget ?? body.totalBudget);
  if (!(budget > 0)) return fail("A positive 'budget' is required.");

  const where = {
    status: "ACTIVE",
    mosqueFamilies: { some: { mosqueId: mosque.id, isActive: true } },
  };
  if (Array.isArray(body.familyIds) && body.familyIds.length)
    where.id = { in: body.familyIds };

  const families = await prisma.family.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      svfScore: true,
      priority: true,
      members: { select: { id: true } },
    },
  });

  // Fall back to mosque settings for reserve / minimum if not provided.
  // Select only the two columns we actually need: selecting the whole row made
  // this endpoint crash with Prisma P2022 (ColumnNotFound) whenever the
  // database schema was behind the Prisma schema. Also degrade gracefully so a
  // settings read can never 500 a pure simulation.
  let settings = null;
  try {
    settings = await prisma.mosqueSettings.findUnique({
      where: { mosqueId: mosque.id },
      select: { reservePercentage: true, minimumDistributionAmount: true },
    });
  } catch (e) {
    console.warn(
      "[distribution/calculate] Could not read MosqueSettings, using Water-Filling defaults. " +
        "Run `npx prisma migrate dev` to sync the database schema. Cause:",
      e?.code ?? e?.name ?? e,
    );
  }
  const opts = {
    reserve:
      body.reserve !== undefined
        ? Number(body.reserve)
        : settings
          ? Number(settings.reservePercentage)
          : undefined,
    minAmt:
      body.minAmt !== undefined
        ? Number(body.minAmt)
        : settings && Number(settings.minimumDistributionAmount) > 0
          ? Number(settings.minimumDistributionAmount)
          : undefined,
    maxAmt: body.maxAmt !== undefined ? Number(body.maxAmt) : undefined,
  };

  const result = calculateWaterFilling(families, budget, opts);
  if (!result.success) return fail(result.message, 422, { result });

  // calculateWaterFilling() is a pure algorithm and doesn't know about
  // priority or family size — merge those back in here so the frontend
  // can render the Priorité pill and "N dépendants" line.
  const famMap = Object.fromEntries(families.map((f) => [f.id, f]));
  result.distributions = result.distributions.map((d) => ({
    ...d,
    priority: famMap[d.familyId]?.priority ?? "LOW",
    dependents: famMap[d.familyId]?.members?.length ?? 0,
  }));

  return ok(result);
}