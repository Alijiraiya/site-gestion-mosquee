import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

// DELETE /api/documents/:docId -- remove a stored family document.
export async function DELETE(request, { params }) {
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

  await prisma.familyDocument.delete({ where: { id: docId } });
  return ok({ message: "Document deleted." });
}
