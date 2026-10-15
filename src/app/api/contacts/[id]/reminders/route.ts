import { and, eq, isNull, sql } from "drizzle-orm";
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
  // A second click for the same day does not add a second reminder.
  const [same] = await db()
    .select({ id: reminders.id })
    .from(reminders)
    .where(
      and(
        eq(reminders.contactId, params.id),
        isNull(reminders.doneAt),
        sql`${reminders.dueAt}::date = ${dueAt.toISOString().slice(0, 10)}::date`,
      ),
    )
    .limit(1);
  if (same) return { ok: true, dueAt: dueAt.toISOString(), duplicate: true };
  await db()
    .insert(reminders)
    .values({ contactId: params.id, dueAt, note: b.note ?? null });
  await db().update(contacts).set({ followUpAt: dueAt }).where(eq(contacts.id, params.id));
  await refreshDerived([params.id]);
  return { ok: true, dueAt: dueAt.toISOString() };
});
