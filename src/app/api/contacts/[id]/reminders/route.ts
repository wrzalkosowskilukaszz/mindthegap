import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { contacts, reminders } from "@/server/db/schema";
import { api, parseBody } from "@/server/http";
import { refreshDerived } from "@/server/services/contacts";

const Body = z.union([
  z.object({ days: z.number().int().min(1).max(365), note: z.string().max(500).optional() }),
  z.object({ doneId: z.string().uuid() }),
]);

export const POST = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(req, Body);
  if ("doneId" in b) {
    await db()
      .update(reminders)
      .set({ doneAt: new Date() })
      .where(and(eq(reminders.id, b.doneId), eq(reminders.contactId, params.id)));
    return { ok: true };
  }
  const dueAt = new Date(Date.now() + b.days * 86_400_000);
  await db()
    .insert(reminders)
    .values({ contactId: params.id, dueAt, note: b.note ?? null });
  await db().update(contacts).set({ followUpAt: dueAt }).where(eq(contacts.id, params.id));
  await refreshDerived([params.id]);
  return { ok: true, dueAt: dueAt.toISOString() };
});
