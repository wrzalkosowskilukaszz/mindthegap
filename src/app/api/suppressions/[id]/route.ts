import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { suppressions } from "@/server/db/schema";
import { api } from "@/server/http";

export const DELETE = api<{ id: string }>(async (_req, { params }) => {
  await db().delete(suppressions).where(eq(suppressions.id, params.id));
  return { ok: true };
});
