import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { contacts, inboundMessages, messages, reminders } from "@/server/db/schema";
import { api, notFound, parseBody } from "@/server/http";
import { recordContactEvent, refreshDerived } from "@/server/services/contacts";

/** Manual reply logging when Gmail reply tracking isn't connected. */
export const POST = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({
      classification: z.enum(["human_reply", "auto_reply", "bounce"]).default("human_reply"),
      receivedAt: z.string().datetime().optional(),
    }),
  );
  const [c] = await db().select().from(contacts).where(eq(contacts.id, params.id)).limit(1);
  if (!c) throw notFound();
  const [last] = await db()
    .select()
    .from(messages)
    .where(and(eq(messages.contactId, c.id), eq(messages.status, "sent")))
    .orderBy(desc(messages.sentAt))
    .limit(1);
  await db()
    .insert(inboundMessages)
    .values({
      gmailMessageId: `manual:${randomUUID()}`,
      gmailThreadId: last?.gmailThreadId ?? `manual:${c.id}`,
      messageId: last?.id ?? null,
      contactId: c.id,
      receivedAt: b.receivedAt ? new Date(b.receivedAt) : new Date(),
      classification: b.classification,
      classifiedBy: "user",
    });
  if (b.classification === "human_reply") {
    await db().update(contacts).set({ followUpAt: null }).where(eq(contacts.id, c.id));
    await db()
      .update(reminders)
      .set({ doneAt: new Date() })
      .where(and(eq(reminders.contactId, c.id), isNull(reminders.doneAt)));
  }
  if (b.classification === "bounce")
    await db()
      .update(contacts)
      .set({ emailStatus: "invalid", emailCheckedAt: new Date() })
      .where(eq(contacts.id, c.id));
  await recordContactEvent(c.id, "reply_logged_manually", { classification: b.classification });
  await refreshDerived([c.id]);
  return { ok: true };
});
