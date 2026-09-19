import prisma from "@/lib/prisma";
import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

function toDocResponse(doc) {
  return {
    id: doc.id,
    familyId: doc.familyId,
    originalName: doc.originalName,
    storedName: doc.storedName,
    mimeType: doc.mimeType,
    size: doc.size,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// GET /api/families/:id/documents -- list stored documents for one family.
export async function GET(request, { params }) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  // Next 15/16: `params` is a Promise and MUST be awaited. Reading `params.id`
  // directly yielded `undefined`, so every document lookup 404'd.
  const { id } = await params;

  const family = await prisma.family.findFirst({
    where: {
      id,
      mosqueFamilies: { some: { mosqueId: mosque.id } },
    },
    select: { id: true },
  });
  if (!family) return fail("Family not found.", 404);

  const documents = await prisma.familyDocument.findMany({
    where: { familyId: family.id },
    orderBy: { createdAt: "desc" },
  });

  return ok({ documents: documents.map(toDocResponse), count: documents.length });
}

// POST /api/families/:id/documents -- store a document payload as base64.
// Body: { originalName, contentBase64, mimeType?, notes? }
export async function POST(request, { params }) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);
  const [body, err] = await readJson(request);
  if (err) return err;

  if (!body.originalName) return fail("originalName is required.");
  if (!body.contentBase64) return fail("contentBase64 is required.");

  const { id } = await params;

  const family = await prisma.family.findFirst({
    where: {
      id,
      mosqueFamilies: { some: { mosqueId: mosque.id } },
    },
    select: { id: true },
  });
  if (!family) return fail("Family not found.", 404);

  const document = await prisma.familyDocument.create({
    data: {
      familyId: family.id,
      originalName: String(body.originalName),
      storedName: body.storedName || `${Date.now()}-${String(body.originalName)}`,
      mimeType: body.mimeType ?? null,
      size: body.size !== undefined ? Number(body.size) : null,
      contentBase64: String(body.contentBase64),
      notes: body.notes ?? null,
      uploadedById: user.id,
    },
  });

  return created({ document: toDocResponse(document) });
}
