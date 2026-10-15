/**
 * Sending. One approved snapshot → at most one provider send:
 *  1. eligibility, suppression, approval hash and limits are re-checked immediately before dispatch;
 *  2. the message moves approved|scheduled → sending in one conditional UPDATE (no double sends);
 *  3. a definite answer marks it sent/failed; a timeout or 5xx marks it "uncertain" and is NEVER retried
 *     automatically — it must be reconciled (Sent folder lookup) or confirmed by the owner.
 * "Sent" means accepted by Gmail, not delivered or read.
 */
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { emailDomain } from "@/lib/normalize";
import { db } from "../db/client.ts";
import { contacts, documentVersions, fileChunks, messages, reminders, sendAttempts } from "../db/schema.ts";
import { env } from "../env.ts";
import { logEvent } from "../events.ts";
import { conflict } from "../http.ts";
import { recordContactEvent, refreshDerived } from "../services/contacts.ts";
import { approvalValid, attachmentsOf, finalText, getMessage, preSendCheck } from "../services/messages.ts";
import { getSettings } from "../settings.ts";
import { GmailApiError, getMessageMetadata, header, listSent, sendRaw } from "./api.ts";
import { buildRaw, newMessageId } from "./mime.ts";
import { accessToken, GmailAuthError, hasScope, SCOPE_METADATA, SCOPE_SEND } from "./oauth.ts";

export type SendOutcome = {
  status: "sent" | "failed" | "uncertain" | "blocked" | "deferred";
  message: string;
};

async function sentTodayCount(): Promise<number> {
  const start = DateTime.now().setZone("Europe/Warsaw").startOf("day").toJSDate();
  const [r] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.status, "sent"), gte(messages.sentAt, start)));
  return r?.n ?? 0;
}

export async function loadAttachment(
  versionId: string,
): Promise<{ filename: string; contentType: string; content: Buffer }> {
  const [v] = await db().select().from(documentVersions).where(eq(documentVersions.id, versionId)).limit(1);
  if (!v) throw new Error("Załącznik nie istnieje");
  const chunks = await db()
    .select()
    .from(fileChunks)
    .where(eq(fileChunks.versionId, versionId))
    .orderBy(fileChunks.idx);
  const content = Buffer.concat(chunks.map((c) => c.data));
  if (content.length !== v.sizeBytes) throw new Error(`Załącznik „${v.filename}” jest niekompletny`);
  return { filename: v.filename, contentType: v.mimeType, content };
}

export async function sendMessage(messageId: string): Promise<SendOutcome> {
  if (!env().SENDING_ENABLED) {
    return {
      status: "blocked",
      message: "Wysyłka jest wyłączona w tym środowisku (SENDING_ENABLED=false). Nic nie zostało wysłane.",
    };
  }
  const m = await getMessage(messageId);
  if (m.status !== "approved" && m.status !== "scheduled")
    throw conflict(`Wiadomość w stanie „${m.status}” nie może zostać wysłana.`);
  if (!(await approvalValid(m))) {
    await db()
      .update(messages)
      .set({
        status: "draft",
        approval: null,
        scheduledFor: null,
        sendError: "Zatwierdzenie nieaktualne — treść, odbiorca lub załączniki zmieniły się.",
      })
      .where(eq(messages.id, m.id));
    return { status: "blocked", message: "Zatwierdzenie jest nieaktualne. Przejrzyj i zatwierdź ponownie." };
  }
  const check = await preSendCheck(m);
  if (check.blockers.length) {
    await db()
      .update(messages)
      .set({ status: "failed", sendError: check.blockers.join(" ") })
      .where(eq(messages.id, m.id));
    await refreshDerived([m.contactId]);
    return { status: "blocked", message: check.blockers.join(" ") };
  }
  const out = await getSettings("outreach");
  if ((await sentTodayCount()) >= out.dailySendLimit)
    return { status: "deferred", message: `Osiągnięto dzienny limit wysyłki (${out.dailySendLimit}).` };

  // Authorisation first: nothing is sent and nothing changes state if Gmail is not usable.
  let acct: Awaited<ReturnType<typeof accessToken>>["account"];
  try {
    acct = (await accessToken()).account;
  } catch (e) {
    return { status: "deferred", message: e instanceof Error ? e.message : "Gmail niedostępny" };
  }
  if (!hasScope(acct.scopes, SCOPE_SEND))
    return {
      status: "deferred",
      message: "Brak uprawnienia do wysyłki (gmail.send). Włącz wysyłkę w Ustawieniach.",
    };

  const profile = await getSettings("profile");
  const parent = m.parentMessageId ? await getMessage(m.parentMessageId).catch(() => null) : null;
  const rfcId = newMessageId(emailDomain(acct.email));
  const raw = await buildRaw({
    fromName: profile.senderName,
    fromEmail: acct.email,
    to: m.toEmail!,
    subject: m.subject,
    text: await finalText(m),
    messageId: rfcId,
    inReplyTo: parent?.rfcMessageId ?? null,
    references: parent?.rfcMessageId ? [parent.rfcMessageId] : [],
    attachments: await Promise.all((await attachmentsOf(m.id)).map((a) => loadAttachment(a.versionId))),
  });
  if (raw.length > 6_500_000) {
    await db()
      .update(messages)
      .set({
        status: "failed",
        sendError: "Wiadomość z załącznikami przekracza 5 MB (limit prostego wysyłania).",
      })
      .where(eq(messages.id, m.id));
    return { status: "failed", message: "Załączniki są za duże (limit ok. 5 MB)." };
  }

  // Claim: approved|scheduled → sending (exactly once).
  const claimed = await db()
    .update(messages)
    .set({ status: "sending", rfcMessageId: rfcId, updatedAt: new Date() })
    .where(
      and(
        eq(messages.id, m.id),
        inArray(messages.status, ["approved", "scheduled"]),
        eq(messages.revision, m.revision),
      ),
    )
    .returning({ id: messages.id });
  if (!claimed.length) return { status: "blocked", message: "Wiadomość jest już wysyłana lub zmieniła się." };
  const [attempt] = await db()
    .insert(sendAttempts)
    .values({ messageId: m.id, status: "started" })
    .returning();

  try {
    const res = await sendRaw(raw, parent?.gmailThreadId ?? null);
    await markSent(m.id, attempt!.id, res.id, res.threadId, rfcId, res);
    return { status: "sent", message: "Wysłano (przyjęte przez Gmail)." };
  } catch (e) {
    const definite =
      e instanceof GmailAuthError ||
      (e instanceof GmailApiError &&
        (e.kind === "invalid" || e.kind === "auth" || e.kind === "rate_limited"));
    const msg = e instanceof Error ? e.message : String(e);
    if (definite) {
      // The request was rejected: nothing was sent. Rate limits and auth problems go back to the queue.
      const back = e instanceof GmailApiError && e.kind === "invalid" ? "failed" : m.status;
      await db()
        .update(sendAttempts)
        .set({ status: "failed", finishedAt: new Date(), error: msg.slice(0, 500) })
        .where(eq(sendAttempts.id, attempt!.id));
      await db()
        .update(messages)
        .set({ status: back, sendError: msg.slice(0, 500), rfcMessageId: null })
        .where(eq(messages.id, m.id));
      await refreshDerived([m.contactId]);
      if (back === "failed")
        await logEvent("error", "gmail", "Wysyłka odrzucona przez Gmail", {
          messageId: m.id,
          message: msg.slice(0, 200),
        });
      return { status: back === "failed" ? "failed" : "deferred", message: msg };
    }
    await db()
      .update(sendAttempts)
      .set({ status: "uncertain", finishedAt: new Date(), error: msg.slice(0, 500) })
      .where(eq(sendAttempts.id, attempt!.id));
    await db()
      .update(messages)
      .set({ status: "uncertain", sendError: `Wynik niepewny: ${msg.slice(0, 300)}` })
      .where(eq(messages.id, m.id));
    await logEvent("error", "gmail", "Wynik wysyłki niepewny — sprawdź folder Wysłane przed ponowieniem", {
      messageId: m.id,
    });
    await refreshDerived([m.contactId]);
    return {
      status: "uncertain",
      message: "Nie wiadomo, czy wiadomość wyszła. Nie ponawiamy automatycznie — uzgodnij stan.",
    };
  }
}

async function markSent(
  messageId: string,
  attemptId: string,
  gmailId: string,
  threadId: string,
  rfcId: string,
  response: unknown,
) {
  const out = await getSettings("outreach");
  const now = new Date();
  await db()
    .update(sendAttempts)
    .set({ status: "accepted", finishedAt: now, response: response as Record<string, unknown> })
    .where(eq(sendAttempts.id, attemptId));
  const [m] = await db()
    .update(messages)
    .set({
      status: "sent",
      sentAt: now,
      sentVia: "gmail",
      gmailMessageId: gmailId,
      gmailThreadId: threadId,
      rfcMessageId: rfcId,
      sendError: null,
      updatedAt: now,
    })
    .where(eq(messages.id, messageId))
    .returning();
  const followUp = new Date(now.getTime() + out.followUpDays * 86_400_000);
  await db().update(contacts).set({ followUpAt: followUp }).where(eq(contacts.id, m!.contactId));
  await db().insert(reminders).values({
    contactId: m!.contactId,
    messageId,
    dueAt: followUp,
    note: "Follow-up, jeśli brak odpowiedzi",
  });
  await recordContactEvent(m!.contactId, "message_sent", { messageId });
  await refreshDerived([m!.contactId]);
  // If reply tracking is enabled, record the Message-ID Gmail actually stored (it may rewrite ours).
  try {
    const { account } = await accessToken();
    if (hasScope(account.scopes, SCOPE_METADATA)) {
      const meta = await getMessageMetadata(gmailId);
      const actual = header(meta, "Message-ID");
      if (actual && actual !== rfcId)
        await db().update(messages).set({ rfcMessageId: actual }).where(eq(messages.id, messageId));
    }
  } catch {
    /* best effort */
  }
}

/** Uncertain send: look for our Message-ID among recent SENT messages (needs gmail.metadata). */
export async function reconcile(
  messageId: string,
): Promise<{ result: "found" | "not_found" | "no_scope"; message: string }> {
  const m = await getMessage(messageId);
  if (m.status !== "uncertain")
    return { result: "not_found", message: "Wiadomość nie jest w stanie niepewnym." };
  const { account } = await accessToken();
  if (!hasScope(account.scopes, SCOPE_METADATA)) {
    return {
      result: "no_scope",
      message:
        "Bez uprawnienia do odczytu nagłówków nie da się sprawdzić folderu Wysłane automatycznie. Sprawdź w Gmailu i potwierdź ręcznie.",
    };
  }
  const list = await listSent(30);
  for (const s of list.messages ?? []) {
    const meta = await getMessageMetadata(s.id);
    if (header(meta, "Message-ID") === m.rfcMessageId) {
      const [attempt] = await db()
        .select()
        .from(sendAttempts)
        .where(and(eq(sendAttempts.messageId, messageId), eq(sendAttempts.status, "uncertain")))
        .limit(1);
      await markSent(
        messageId,
        attempt?.id ??
          (await db().insert(sendAttempts).values({ messageId, status: "reconciled_sent" }).returning())[0]!
            .id,
        s.id,
        s.threadId,
        m.rfcMessageId!,
        { reconciled: true },
      );
      return { result: "found", message: "Znaleziono w folderze Wysłane — oznaczono jako wysłaną." };
    }
  }
  return {
    result: "not_found",
    message:
      "Nie znaleziono w 30 ostatnich wysłanych. Jeśli w Gmailu też jej nie ma, możesz ją bezpiecznie zatwierdzić i wysłać ponownie.",
  };
}

/** Owner's manual resolution of an uncertain send. */
export async function resolveUncertain(messageId: string, wasSent: boolean): Promise<void> {
  const m = await getMessage(messageId);
  if (m.status !== "uncertain") throw conflict("Wiadomość nie jest w stanie niepewnym.");
  if (wasSent) {
    const [a] = await db()
      .insert(sendAttempts)
      .values({ messageId, status: "reconciled_sent", finishedAt: new Date() })
      .returning();
    await markSent(messageId, a!.id, m.gmailMessageId ?? "", m.gmailThreadId ?? "", m.rfcMessageId ?? "", {
      manual: true,
    });
  } else {
    await db()
      .insert(sendAttempts)
      .values({ messageId, status: "reconciled_not_sent", finishedAt: new Date() });
    await db()
      .update(messages)
      .set({
        status: "draft",
        approval: null,
        rfcMessageId: null,
        sendError: "Potwierdzono: nie wysłano. Zatwierdź ponownie, aby wysłać.",
      })
      .where(eq(messages.id, messageId));
    await refreshDerived([m.contactId]);
  }
}

/** Called by the scheduler tick. */
export async function sendDueMessages(opts: {
  deadline: number;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const out = await getSettings("outreach");
  const due = await db()
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.status, "scheduled"), lte(messages.scheduledFor, new Date())))
    .orderBy(messages.scheduledFor)
    .limit(50);
  const r = { sent: 0, failed: 0, skipped: 0 };
  for (const [i, d] of due.entries()) {
    if (Date.now() > opts.deadline) break;
    if (i > 0 && out.minSecondsBetweenSends > 0)
      await new Promise((res) => setTimeout(res, out.minSecondsBetweenSends * 1000));
    const res = await sendMessage(d.id).catch((e) => ({ status: "failed" as const, message: String(e) }));
    if (res.status === "sent") r.sent++;
    else if (res.status === "failed" || res.status === "uncertain") r.failed++;
    else r.skipped++;
    if (res.status === "deferred" && /autoryzac|Gmail nie|uprawnien/i.test(res.message)) break;
  }
  return r;
}

/**
 * Gmail is optional: the owner can send the approved text from their own mail app and record it here.
 * Only an approved, still-valid snapshot can be marked as sent.
 */
export async function markSentManually(messageId: string, sentAt: Date): Promise<void> {
  const m = await getMessage(messageId);
  if (m.status !== "approved" && m.status !== "scheduled")
    throw conflict("Najpierw zatwierdź wiadomość — oznaczamy jako wysłaną dokładnie zatwierdzoną treść.");
  if (!(await approvalValid(m))) throw conflict("Zatwierdzenie jest nieaktualne. Zatwierdź ponownie.");
  const out = await getSettings("outreach");
  const [a] = await db()
    .insert(sendAttempts)
    .values({ messageId, status: "manual", finishedAt: new Date(), response: { manual: true } })
    .returning();
  await db()
    .update(messages)
    .set({
      status: "sent",
      sentAt,
      sentVia: "manual",
      scheduledFor: null,
      sendError: null,
      updatedAt: new Date(),
    })
    .where(eq(messages.id, messageId));
  const followUp = new Date(sentAt.getTime() + out.followUpDays * 86_400_000);
  await db().update(contacts).set({ followUpAt: followUp }).where(eq(contacts.id, m.contactId));
  await db()
    .insert(reminders)
    .values({ contactId: m.contactId, messageId, dueAt: followUp, note: "Follow-up, jeśli brak odpowiedzi" });
  await recordContactEvent(m.contactId, "message_sent_manually", { messageId, attemptId: a!.id });
  await refreshDerived([m.contactId]);
}
