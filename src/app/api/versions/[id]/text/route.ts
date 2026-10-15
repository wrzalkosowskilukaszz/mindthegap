import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { documentVersions } from "@/server/db/schema";
import { api, notFound } from "@/server/http";

export const GET = api<{ id: string }>(async (_req, { params }) => {
  const [v] = await db()
    .select({
      text: documentVersions.extractedText,
      status: documentVersions.extractionStatus,
      error: documentVersions.extractionError,
    })
    .from(documentVersions)
    .where(eq(documentVersions.id, params.id))
    .limit(1);
  if (!v) throw notFound();
  return v;
});
