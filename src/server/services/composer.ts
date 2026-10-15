/** Composer orchestration: data for the screen, generation and quick actions (AI), linting. */
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { aiConfigured } from "../ai/client.ts";
import { buildComposeContext, generateEmail, lintDraft, PROMPT_VERSION, type QuickAction, rewriteEmail } from "../ai/compose.ts";
import { db } from "../db/client.ts";
import { companies, documents, documentVersions, messageRevisions, programs } from "../db/schema.ts";
import { env } from "../env.ts";
import { gmailSearchUrl, openInGmailUrl } from "../gmail/api.ts";
import { currentAccount, hasScope, SCOPE_SEND } from "../gmail/oauth.ts";
import { getSettings } from "../settings.ts";
import { getContactDetail } from "./contact-detail.ts";
import { attachmentsOf, finalText, getMessage, type MessageRow, preSendCheck, saveGenerated } from "./messages.ts";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function lintForMessage(m: MessageRow) {
  const ctx = await buildComposeContext({ contactId: m.contactId, programId: m.programId, language: m.language, kind: m.kind as "initial" | "follow_up", parentMessageId: m.parentMessageId });
  return lintDraft(ctx, m.subject, m.body);
}

export async function composerData(id: string) {
  const m = await getMessage(id);
  const contact = await getContactDetail(m.contactId);
  const lint = m.body.trim() ? await lintForMessage(m) : [];
  const check = await preSendCheck(m, lint);
  const progs = await db().select({ id: programs.id, name: programs.name, status: programs.status, defaultAttachmentVersionId: programs.defaultAttachmentVersionId }).from(programs).orderBy(asc(programs.name));
  const attachable = await db()
    .select({ versionId: documentVersions.id, title: documents.title, filename: documentVersions.filename, version: documentVersions.version, sizeBytes: documentVersions.sizeBytes, programId: documents.programId, mimeType: documentVersions.mimeType })
    .from(documentVersions)
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(and(eq(documents.usage, "attachment"), isNotNull(documents.approvedAt), isNotNull(documentVersions.approvedAt), eq(documentVersions.complete, true)))
    .orderBy(asc(documents.title), desc(documentVersions.version));
  const revisions = await db().select().from(messageRevisions).where(eq(messageRevisions.messageId, id)).orderBy(desc(messageRevisions.rev)).limit(30);
  const acct = await currentAccount();
  const [co] = await db().select({ name: companies.name, brand: companies.brand }).from(companies).where(eq(companies.id, m.companyId));
  const profile = await getSettings("profile");
  return {
    message: {
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      scheduledFor: iso(m.scheduledFor),
      sentAt: iso(m.sentAt),
    },
    companyName: co?.brand ?? co?.name ?? "",
    contact,
    attachments: await attachmentsOf(id),
    attachable,
    programs: progs,
    revisions: revisions.map((r) => ({ rev: r.rev, origin: r.origin, label: r.label, createdAt: r.createdAt.toISOString(), subject: r.subject, body: r.body })),
    finalText: m.body.trim() ? await finalText(m) : "",
    lint,
    check,
    ai: aiConfigured(),
    sendingEnabled: env().SENDING_ENABLED,
    gmail: acct ? { email: acct.email, status: acct.status, canSend: hasScope(acct.scopes, SCOPE_SEND) } : null,
    openInGmail: m.gmailThreadId && acct ? openInGmailUrl(acct.email, m.gmailThreadId) : null,
    sentSearchUrl: m.status === "uncertain" && acct ? gmailSearchUrl(acct.email, `in:sent to:${m.toEmail ?? ""} subject:"${m.subject}"`) : null,
    profileReady: Boolean(profile.senderName && (m.language === "pl" ? profile.signaturePl : profile.signatureEn)),
  };
}

export type ComposerData = Awaited<ReturnType<typeof composerData>>;

export async function runGenerate(id: string, salutation: "neutral" | "pani" | "pan") {
  const m = await getMessage(id);
  const ctx = await buildComposeContext({ contactId: m.contactId, programId: m.programId, language: m.language, kind: m.kind as "initial" | "follow_up", parentMessageId: m.parentMessageId, salutation });
  const g = await generateEmail(ctx);
  const subject = m.kind === "follow_up" && m.subject ? m.subject : (g.subjects[0] ?? "");
  await saveGenerated(id, {
    subject,
    body: g.body,
    origin: "generated",
    label: "Wygenerowano",
    generation: {
      model: g.model,
      promptVersion: PROMPT_VERSION,
      explanation: g.explanation,
      sources: g.sources,
      warnings: g.warnings.map((w) => w.message),
      subjectOptions: g.subjects,
      variants: g.variants,
      generatedAt: new Date().toISOString(),
    },
  });
  return { ok: true, warnings: g.warnings };
}

export async function runRewrite(id: string, action: QuickAction, opts: { selection?: string; instruction?: string; salutation: "neutral" | "pani" | "pan" }) {
  const m = await getMessage(id);
  const ctx = await buildComposeContext({ contactId: m.contactId, programId: m.programId, language: m.language, kind: m.kind as "initial" | "follow_up", parentMessageId: m.parentMessageId, salutation: opts.salutation });
  const r = await rewriteEmail(ctx, { subject: m.subject, body: m.body }, action, opts);
  const labels: Record<QuickAction, string> = {
    shorten: "Skrócono",
    more_direct: "Bardziej bezpośrednio",
    warmer: "Cieplej",
    stronger_value: "Mocniejsza wartość",
    better_opening: "Nowe otwarcie",
    change_cta: "Inne wezwanie do działania",
    rewrite_selection: "Przepisano zaznaczenie",
  };
  await saveGenerated(id, { subject: r.subject, body: r.body, origin: "quick_action", label: labels[action] });
  return { ok: true, note: r.note, warnings: r.warnings };
}

