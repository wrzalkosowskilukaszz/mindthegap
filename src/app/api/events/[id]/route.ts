import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { appEvents } from "@/server/db/schema";
import { api } from "@/server/http";

export const POST = api<{ id: string }>(async (_req, { params }) => {
  await db().update(appEvents).set({ resolvedAt: new Date() }).where(eq(appEvents.id, params.id));
  return { ok: true };
});
