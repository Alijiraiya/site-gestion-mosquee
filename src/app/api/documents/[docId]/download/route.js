import prisma from "@/lib/prisma";
import { fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET /api/documents/:docId/download -- return the stored document bytes.
export async function GET(request, { params }) {
  const { docId } = await params;
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const document = await prisma.familyDocument.findFirst({
    where: {
      id: docId,
      family: { mosqueFamilies: { some: { mosqueId: mosque.id } } },
    },
  });
  if (!document) return fail("Document not found.", 404);

  const bytes = Buffer.from(document.contentBase64, "base64");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${document.originalName}"`,
      "Content-Length": String(bytes.length),
    },
  });
}
