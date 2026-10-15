import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { savedViews } from "@/server/db/schema";
import { api } from "@/server/http";

export const DELETE = api<{ id: string }>(async (_req, { params }) => {
  await db().delete(savedViews).where(eq(savedViews.id, params.id));
  return { ok: true };
});
