/**
 * Reply synchronisation (needs gmail.metadata: headers only, never message bodies).
 * For each thread we started, new messages not from the owner are classified as human reply,
 * automatic reply or bounce. Reply tracking is reported as unavailable — not as "no replies" —
 * when the permission is missing or the sync fails.
 */
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { contacts, googleAccounts, inboundMessages, messages, reminders } from "../db/schema.ts";
import { logEvent } from "../events.ts";
import { recordContactEvent, refreshDerived } from "../services/contacts.ts";
import { getSettings } from "../settings.ts";
import { getThreadMetadata, header, type MetaMessage } from "./api.ts";
import { accessToken, hasScope, SCOPE_METADATA } from "./oauth.ts";

export function classifyInbound(m: MetaMessage): "human_reply" | "auto_reply" | "bounce" {
  const from = (header(m, "From") ?? "").toLowerCase();
  const subject = (header(m, "Subject") ?? "").toLowerCase();
  const ct = (header(m, "Content-Type") ?? "").toLowerCase();
  if (
    /mailer-daemon|postmaster|mail delivery (subsystem|system)/.test(from) ||
    /multipart\/report/.test(ct) ||
    header(m, "X-Failed-Recipients")
  )
    return "bounce";
  if (
    /^(undeliverable|undelivered|delivery status notification|niedostarczon|returned mail|nie można dostarczyć)/.test(
      subject,
    )
  )
    return "bounce";
  const autoSubmitted = (header(m, "Auto-Submitted") ?? "").toLowerCase();
  const precedence = (header(m, "Precedence") ?? "").toLowerCase();
  if (
    (autoSubmitted && autoSubmitted !== "no") ||
    header(m, "X-Autoreply") ||
    header(m, "X-Autorespond") ||
    /^(auto_reply|bulk|junk|list)$/.test(precedence)
  )
    return "auto_reply";
  if (
    /^(automatic reply|auto(matic)?[- ]?reply|out of (the )?office|autoodpowied|odpowied[zź] automatyczna|nieobecno[sś][cć]|abwesenheit)/.test(
      subject,
    )
  )
    return "auto_reply";
  return "human_reply";
}

function addressOf(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/<([^>]+)>/);
  return (m ? m[1]! : v).trim().toLowerCase();
}

export async function syncReplies(): Promise<{
  synced: boolean;
  replies: number;
  threads: number;
  error?: string;
}> {
  const { account } = await accessToken();
  if (!hasScope(account.scopes, SCOPE_METADATA)) {
    return {
      synced: false,
      replies: 0,
      threads: 0,
      error: "Brak uprawnienia gmail.metadata — śledzenie odpowiedzi wyłączone.",
    };
  }
  const since = new Date(Date.now() - 120 * 86_400_000);
  const threads = await db()
    .selectDistinctOn([messages.gmailThreadId], {
      threadId: messages.gmailThreadId,
      messageId: messages.id,
      contactId: messages.contactId,
    })
    .from(messages)
    .where(and(eq(messages.status, "sent"), isNotNull(messages.gmailThreadId), gte(messages.sentAt, since)))
    .orderBy(messages.gmailThreadId, desc(messages.sentAt));
  let replies = 0;
  try {
    for (const t of threads) {
      const th = await getThreadMetadata(t.threadId!);
      for (const msg of th.messages ?? []) {
        const from = addressOf(header(msg, "From"));
        if (!from || from === account.email.toLowerCase()) continue;
        const exists = await db()
          .select({ id: inboundMessages.id })
          .from(inboundMessages)
          .where(eq(inboundMessages.gmailMessageId, msg.id))
          .limit(1);
        if (exists.length) continue;
        const cls = classifyInbound(msg);
        const receivedAt = msg.internalDate ? new Date(Number(msg.internalDate)) : new Date();
        await db()
          .insert(inboundMessages)
          .values({
            gmailMessageId: msg.id,
            gmailThreadId: t.threadId!,
            messageId: t.messageId,
            contactId: t.contactId,
            fromEmail: from,
            receivedAt,
            subject: (header(msg, "Subject") ?? "").slice(0, 300),
            classification: cls,
          })
          .onConflictDoNothing();
        if (cls === "human_reply") {
          replies++;
          await db().update(contacts).set({ followUpAt: null }).where(eq(contacts.id, t.contactId));
          await db()
            .update(reminders)
            .set({ doneAt: new Date() })
            .where(and(eq(reminders.contactId, t.contactId), sql`${reminders.doneAt} is null`));
          await recordContactEvent(t.contactId, "reply_received", { gmailMessageId: msg.id });
        } else if (cls === "bounce") {
          await db()
            .update(contacts)
            .set({ emailStatus: "invalid", emailCheckedAt: receivedAt, followUpAt: null })
            .where(eq(contacts.id, t.contactId));
          await recordContactEvent(t.contactId, "bounced", { gmailMessageId: msg.id });
        }
        await refreshDerived([t.contactId]);
      }
    }
    await db()
      .update(googleAccounts)
      .set({ lastSyncAt: new Date(), lastSyncOk: true, lastSyncError: null })
      .where(eq(googleAccounts.id, account.id));
    return { synced: true, replies, threads: threads.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db()
      .update(googleAccounts)
      .set({ lastSyncAt: new Date(), lastSyncOk: false, lastSyncError: msg.slice(0, 300) })
      .where(eq(googleAccounts.id, account.id));
    await logEvent("warning", "gmail", "Synchronizacja odpowiedzi nie powiodła się", {
      message: msg.slice(0, 200),
    });
    return { synced: false, replies, threads: threads.length, error: msg };
  }
}

export async function syncRepliesIfDue(): Promise<{
  synced: boolean;
  replies?: number;
  error?: string;
} | null> {
  const [acct] = await db().select().from(googleAccounts).orderBy(desc(googleAccounts.connectedAt)).limit(1);
  if (acct?.status !== "connected" || !hasScope(acct.scopes, SCOPE_METADATA)) return null;
  const sched = await getSettings("scheduler");
  if (
    acct.lastSyncAt &&
    Date.now() - acct.lastSyncAt.getTime() < sched.replySyncIntervalMinutes * 60_000 - 60_000
  )
    return null;
  return syncReplies();
}

/** Corrections: the owner can reclassify an inbound message (e.g. an auto-reply detected as human). */
export async function reclassify(
  inboundId: string,
  classification: "human_reply" | "auto_reply" | "bounce" | "unknown",
) {
  const [i] = await db()
    .update(inboundMessages)
    .set({ classification, classifiedBy: "user" })
    .where(eq(inboundMessages.id, inboundId))
    .returning();
  if (i?.contactId) await refreshDerived([i.contactId]);
}
