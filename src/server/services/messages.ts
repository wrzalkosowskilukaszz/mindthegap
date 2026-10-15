/**
 * Messages: drafts with revisions and autosave, approval of a fixed snapshot, scheduling.
 * Approval covers recipient + subject + the exact final text + attachment versions; any change voids it.
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { checkSendable } from "@/lib/contact-rules";
import { type LintFinding } from "@/lib/email-lint";
import { sha256Hex } from "../crypto.ts";
import { db } from "../db/client.ts";
import {
  type ApprovalSnapshot,
  companies,
  contactEvidence,
  contacts,
  documents,
  documentVersions,
  messageAttachments,
  messageRevisions,
  messages,
  programs,
} from "../db/schema.ts";
import { badRequest, conflict, notFound } from "../http.ts";
import { getSettings } from "../settings.ts";
import { recentCompanyOutreach, recordContactEvent, refreshDerived, suppressionHits } from "./contacts.ts";

export type MessageRow = typeof messages.$inferSelect;

export async function getMessage(id: string): Promise<MessageRow> {
  const [m] = await db().select().from(messages).where(eq(messages.id, id)).limit(1);
  if (!m) throw notFound("Wiadomość nie istnieje");
  return m;
}

async function addRevision(messageId: string, subject: string, body: string, origin: string, label?: string) {
  const [last] = await db().select({ rev: messageRevisions.rev }).from(messageRevisions).where(eq(messageRevisions.messageId, messageId)).orderBy(desc(messageRevisions.rev)).limit(1);
  await db()
    .insert(messageRevisions)
    .values({ messageId, rev: (last?.rev ?? 0) + 1, subject, body, origin, label: label ?? null });
}

/** Default attachment = the programme's default approved attachment version. */
async function defaultAttachmentFor(programId: string | null): Promise<string[]> {
  if (!programId) return [];
  const [p] = await db().select().from(programs).where(eq(programs.id, programId)).limit(1);
  if (!p?.defaultAttachmentVersionId) return [];
  const ok = await isSendableAttachment(p.defaultAttachmentVersionId);
  return ok ? [p.defaultAttachmentVersionId] : [];
}

/** Only approved attachment documents, with a complete, approved version, can be attached. */
export async function isSendableAttachment(versionId: string): Promise<boolean> {
  const [v] = await db()
    .select({ complete: documentVersions.complete, vApproved: documentVersions.approvedAt, usage: documents.usage, dApproved: documents.approvedAt })
    .from(documentVersions)
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(eq(documentVersions.id, versionId))
    .limit(1);
  return Boolean(v?.complete && v.usage === "attachment" && v.dApproved && v.vApproved);
}

export async function createDraft(opts: {
  contactId: string;
  programId: string | null;
  language: "pl" | "en";
  kind?: "initial" | "follow_up";
  parentMessageId?: string | null;
  batchId?: string | null;
}): Promise<MessageRow> {
  const [c] = await db().select().from(contacts).where(eq(contacts.id, opts.contactId)).limit(1);
  if (!c) throw notFound("Kontakt nie istnieje");
  if (c.isDemo) throw badRequest("Rekordy demonstracyjne nie mogą mieć wiadomości.");
  const hits = await suppressionHits({ email: c.email, companyId: c.companyId, contactId: c.id });
  if (hits.length || c.eligibilityBasis === "do_not_contact") throw badRequest("Kontakt jest na liście wykluczeń lub oznaczony „nie kontaktować”.");
  let subject = "";
  if (opts.kind === "follow_up" && opts.parentMessageId) {
    const parent = await getMessage(opts.parentMessageId);
    subject = parent.subject.match(/^re:/i) ? parent.subject : `Re: ${parent.subject}`;
  }
  const [m] = await db()
    .insert(messages)
    .values({
      contactId: c.id,
      companyId: c.companyId,
      programId: opts.programId,
      batchId: opts.batchId ?? null,
      parentMessageId: opts.parentMessageId ?? null,
      kind: opts.kind ?? "initial",
      language: opts.language,
      toEmail: c.email,
      subject,
    })
    .returning();
  for (const [i, v] of (await defaultAttachmentFor(opts.programId)).entries()) {
    await db().insert(messageAttachments).values({ messageId: m!.id, versionId: v, position: i }).onConflictDoNothing();
  }
  await refreshDerived([c.id]);
  return m!;
}

/** Autosave with optimistic concurrency. Any content change voids an approval. */
export async function updateDraft(
  id: string,
  patch: { subject?: string; body?: string; programId?: string | null; language?: "pl" | "en"; attachmentVersionIds?: string[]; revision: number },
): Promise<MessageRow> {
  const m = await getMessage(id);
  if (!["draft", "approved", "failed"].includes(m.status)) throw conflict(`Nie można edytować wiadomości w stanie „${m.status}”.`);
  if (patch.revision !== m.revision) throw conflict("Wiadomość zmieniła się w innym oknie. Odśwież, aby nie nadpisać zmian.", { revision: m.revision });
  const set: Partial<typeof messages.$inferInsert> = { updatedAt: new Date(), revision: m.revision + 1 };
  const contentChanged = (patch.subject !== undefined && patch.subject !== m.subject) || (patch.body !== undefined && patch.body !== m.body);
  if (patch.subject !== undefined) set.subject = patch.subject;
  if (patch.body !== undefined) set.body = patch.body;
  if (patch.programId !== undefined) set.programId = patch.programId;
  if (patch.language !== undefined) set.language = patch.language;
  if (contentChanged) set.userEdited = true;
  let attachmentsChanged = false;
  if (patch.attachmentVersionIds) {
    for (const v of patch.attachmentVersionIds) if (!(await isSendableAttachment(v))) throw badRequest("Można dołączać tylko zatwierdzone załączniki.");
    const cur = (await db().select().from(messageAttachments).where(eq(messageAttachments.messageId, id))).map((a) => a.versionId).sort();
    attachmentsChanged = JSON.stringify(cur) !== JSON.stringify([...patch.attachmentVersionIds].sort());
    if (attachmentsChanged) {
      await db().delete(messageAttachments).where(eq(messageAttachments.messageId, id));
      for (const [i, v] of patch.attachmentVersionIds.entries()) await db().insert(messageAttachments).values({ messageId: id, versionId: v, position: i });
    }
  }
  if ((contentChanged || attachmentsChanged || patch.language !== undefined) && m.status === "approved") {
    set.status = "draft";
    set.approval = null;
  }
  const [updated] = await db().update(messages).set(set).where(and(eq(messages.id, id), eq(messages.revision, m.revision))).returning();
  if (!updated) throw conflict("Wiadomość zmieniła się w międzyczasie. Odśwież.");
  if (contentChanged) {
    const [last] = await db().select().from(messageRevisions).where(eq(messageRevisions.messageId, id)).orderBy(desc(messageRevisions.rev)).limit(1);
    if (!last || last.origin !== "edit" || Date.now() - last.createdAt.getTime() > 120_000) {
      await addRevision(id, updated.subject, updated.body, "edit", "Twoja edycja");
    } else {
      await db().update(messageRevisions).set({ subject: updated.subject, body: updated.body }).where(eq(messageRevisions.id, last.id));
    }
  }
  return updated;
}

export async function saveGenerated(
  id: string,
  out: { subject: string; body: string; origin: string; label: string; generation?: Partial<MessageRow["generation"]> },
): Promise<MessageRow> {
  const m = await getMessage(id);
  if (!["draft", "approved", "failed"].includes(m.status)) throw conflict("Tej wiadomości nie można już zmieniać.");
  // Keep the current text in history before replacing it.
  if (m.body.trim()) {
    const [last] = await db().select().from(messageRevisions).where(eq(messageRevisions.messageId, id)).orderBy(desc(messageRevisions.rev)).limit(1);
    if (!last || last.body !== m.body || last.subject !== m.subject) await addRevision(id, m.subject, m.body, m.userEdited ? "edit" : "generated", "Przed zmianą");
  }
  const [u] = await db()
    .update(messages)
    .set({
      subject: out.subject,
      body: out.body,
      userEdited: out.origin === "generated" ? false : m.userEdited,
      generation: out.generation ? { ...m.generation, ...out.generation } : m.generation,
      status: "draft",
      approval: null,
      revision: m.revision + 1,
      updatedAt: new Date(),
    })
    .where(eq(messages.id, id))
    .returning();
  await addRevision(id, out.subject, out.body, out.origin, out.label);
  return u!;
}

export async function restoreRevision(id: string, rev: number): Promise<MessageRow> {
  const [r] = await db().select().from(messageRevisions).where(and(eq(messageRevisions.messageId, id), eq(messageRevisions.rev, rev))).limit(1);
  if (!r) throw notFound("Wersja nie istnieje");
  return saveGenerated(id, { subject: r.subject, body: r.body, origin: "restore", label: `Przywrócono wersję ${rev}` });
}

// ---------------------------------------------------------------------------
// Final text, approval, scheduling
// ---------------------------------------------------------------------------

async function sourceDescription(contactId: string, lang: "pl" | "en"): Promise<string> {
  const [c] = await db().select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  const [ev] = await db()
    .select()
    .from(contactEvidence)
    .where(and(eq(contactEvidence.contactId, contactId), sql`'email' = any(select jsonb_array_elements_text(${contactEvidence.supports}))`))
    .orderBy(asc(contactEvidence.createdAt))
    .limit(1);
  if (ev?.url) {
    try {
      const u = new URL(ev.url);
      return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
    } catch {
      /* fall through */
    }
  }
  if (ev?.provider) return lang === "pl" ? `serwis ${ev.provider} (publiczne źródła internetowe)` : `${ev.provider} (public web sources)`;
  if (c?.emailOrigin === "imported" || c?.emailOrigin === "user_entered") return lang === "pl" ? "moje notatki kontaktowe" : "my contact notes";
  return lang === "pl" ? "publiczna strona firmy" : "the company's public website";
}

/** The exact text that will be sent: body + signature (+ first-contact privacy notice). */
export async function finalText(m: MessageRow): Promise<string> {
  const profile = await getSettings("profile");
  const privacy = await getSettings("privacy");
  const sig = (m.language === "pl" ? profile.signaturePl : profile.signatureEn).trim();
  let text = m.body.trim();
  if (sig) text += `\n\n${sig}`;
  if (privacy.includePrivacyFooter && m.kind === "initial") {
    const tpl = m.language === "pl" ? privacy.footerPl : privacy.footerEn;
    const footer = tpl
      .replace("{source}", await sourceDescription(m.contactId, m.language))
      .replace("{controller}", privacy.controllerName || profile.senderName || profile.businessName);
    text += `\n\n—\n${footer}`;
  }
  return text;
}

export async function attachmentsOf(messageId: string) {
  return db()
    .select({
      versionId: documentVersions.id,
      filename: documentVersions.filename,
      mimeType: documentVersions.mimeType,
      sizeBytes: documentVersions.sizeBytes,
      sha256: documentVersions.sha256,
      version: documentVersions.version,
      title: documents.title,
    })
    .from(messageAttachments)
    .innerJoin(documentVersions, eq(documentVersions.id, messageAttachments.versionId))
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(eq(messageAttachments.messageId, messageId))
    .orderBy(asc(messageAttachments.position));
}

export async function snapshotHash(m: MessageRow): Promise<{ hash: string; to: string; text: string; attachmentVersionIds: string[] }> {
  const atts = await attachmentsOf(m.id);
  const text = await finalText(m);
  const ids = atts.map((a) => `${a.versionId}:${a.sha256}`).sort();
  const hash = sha256Hex(JSON.stringify({ to: m.toEmail ?? "", subject: m.subject, text, ids }));
  return { hash, to: m.toEmail ?? "", text, attachmentVersionIds: atts.map((a) => a.versionId) };
}

export type PreSendCheck = { blockers: string[]; warnings: string[]; lint: LintFinding[] };

export async function preSendCheck(m: MessageRow, lint: LintFinding[] = []): Promise<PreSendCheck> {
  const [c] = await db().select().from(contacts).where(eq(contacts.id, m.contactId)).limit(1);
  if (!c) return { blockers: ["Kontakt nie istnieje"], warnings: [], lint };
  const fr = await getSettings("freshness");
  const out = await getSettings("outreach");
  const hits = await suppressionHits({ email: c.email, companyId: c.companyId, contactId: c.id });
  const recent = await recentCompanyOutreach(c.companyId, c.id, out.recentCompanyContactDays);
  const res = checkSendable({ ...c, suppressed: hits.length > 0 }, fr, {
    requireEligibilityBasis: out.requireEligibilityBasis,
    recentCompanyContact: recent[0] ? { at: recent[0].at, who: recent[0].who } : null,
  });
  const blockers = [...res.blockers];
  if (!m.subject.trim() || !m.body.trim()) blockers.push("Brak tematu lub treści.");
  if (m.toEmail !== c.email) blockers.push("Adres odbiorcy zmienił się od utworzenia szkicu — utwórz szkic ponownie.");
  if (lint.some((f) => f.level === "error")) blockers.push("Treść narusza zasady (np. liczby lub linki spoza zatwierdzonych faktów) — popraw przed zatwierdzeniem.");
  for (const a of await attachmentsOf(m.id)) {
    if (!(await isSendableAttachment(a.versionId))) blockers.push(`Załącznik „${a.filename}” nie jest zatwierdzony do wysyłki.`);
  }
  return { blockers, warnings: res.warnings, lint };
}

export async function approve(id: string, opts: { acknowledgeWarnings: boolean; lint: LintFinding[] }): Promise<MessageRow> {
  const m = await getMessage(id);
  if (m.status !== "draft" && m.status !== "failed") throw conflict("Tylko szkic można zatwierdzić.");
  const check = await preSendCheck(m, opts.lint);
  if (check.blockers.length) throw badRequest("Wysyłka zablokowana", check.blockers);
  if (check.warnings.length && !opts.acknowledgeWarnings) throw badRequest("Potwierdź ostrzeżenia przed zatwierdzeniem.", check.warnings);
  const snap = await snapshotHash(m);
  const approval: ApprovalSnapshot = {
    hash: snap.hash,
    approvedAt: new Date().toISOString(),
    to: snap.to,
    subject: m.subject,
    attachmentVersionIds: snap.attachmentVersionIds,
    staleAcknowledged: check.warnings.some((w) => /weryfik|źródło|zatrudnien|zmiana prac/i.test(w)),
    companyContactAcknowledged: check.warnings.some((w) => w.startsWith("W tej firmie")),
  };
  const [u] = await db()
    .update(messages)
    .set({ status: "approved", approval, sendError: null, updatedAt: new Date() })
    .where(and(eq(messages.id, id), eq(messages.revision, m.revision)))
    .returning();
  if (!u) throw conflict("Wiadomość zmieniła się w trakcie zatwierdzania.");
  await recordContactEvent(m.contactId, "message_approved", { messageId: id });
  return u;
}

/** True only when the stored approval matches the current content exactly. */
export async function approvalValid(m: MessageRow): Promise<boolean> {
  if (!m.approval) return false;
  const snap = await snapshotHash(m);
  return snap.hash === m.approval.hash;
}

export async function schedule(id: string, at: Date): Promise<MessageRow> {
  const m = await getMessage(id);
  if (m.status !== "approved") throw conflict("Najpierw zatwierdź wiadomość.");
  if (!(await approvalValid(m))) throw conflict("Zatwierdzenie jest nieaktualne — treść lub załączniki się zmieniły.");
  if (at.getTime() < Date.now() - 60_000) throw badRequest("Termin wysyłki jest w przeszłości.");
  const [u] = await db().update(messages).set({ status: "scheduled", scheduledFor: at, updatedAt: new Date() }).where(eq(messages.id, id)).returning();
  await refreshDerived([m.contactId]);
  return u!;
}

export async function unschedule(id: string): Promise<MessageRow> {
  const [u] = await db()
    .update(messages)
    .set({ status: "approved", scheduledFor: null, updatedAt: new Date() })
    .where(and(eq(messages.id, id), eq(messages.status, "scheduled")))
    .returning();
  if (!u) throw conflict("Wiadomość nie jest zaplanowana (mogła właśnie zostać wysłana).");
  await refreshDerived([u.contactId]);
  return u;
}

export async function discard(id: string): Promise<void> {
  const m = await getMessage(id);
  if (!["draft", "approved", "failed"].includes(m.status)) throw conflict("Tej wiadomości nie można usunąć.");
  await db().delete(messages).where(eq(messages.id, id));
  await refreshDerived([m.contactId]);
}

export async function listMessages(box: "drafts" | "scheduled" | "sent" | "replies" | "problems", limit = 200) {
  const statusFor: Record<string, MessageRow["status"][]> = {
    drafts: ["draft", "approved"],
    scheduled: ["scheduled", "sending"],
    sent: ["sent"],
    problems: ["failed", "uncertain"],
  };
  if (box === "replies") {
    const rows = await db().execute<Record<string, unknown>>(sql`
      select i.id, i.received_at as "receivedAt", i.classification, i.from_email as "fromEmail", i.subject, i.gmail_thread_id as "threadId",
             i.message_id as "messageId", c.id as "contactId", coalesce(c.full_name, c.department_label, c.email) as "who", co.name as "companyName"
      from inbound_messages i left join contacts c on c.id = i.contact_id left join companies co on co.id = c.company_id
      order by i.received_at desc limit ${limit}`);
    return { kind: "replies" as const, rows: rows as unknown as Record<string, unknown>[] };
  }
  const rows = await db()
    .select({
      id: messages.id,
      subject: messages.subject,
      status: messages.status,
      language: messages.language,
      kind: messages.kind,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
      scheduledFor: messages.scheduledFor,
      sentAt: messages.sentAt,
      sendError: messages.sendError,
      gmailThreadId: messages.gmailThreadId,
      contactId: contacts.id,
      who: sql<string>`coalesce(${contacts.fullName}, ${contacts.departmentLabel}, ${contacts.email})`,
      toEmail: messages.toEmail,
      outreachStatus: contacts.outreachStatus,
      companyName: companies.name,
      programName: programs.name,
    })
    .from(messages)
    .innerJoin(contacts, eq(contacts.id, messages.contactId))
    .innerJoin(companies, eq(companies.id, messages.companyId))
    .leftJoin(programs, eq(programs.id, messages.programId))
    .where(inArray(messages.status, statusFor[box]!))
    .orderBy(box === "sent" ? desc(messages.sentAt) : box === "scheduled" ? asc(messages.scheduledFor) : desc(messages.updatedAt))
    .limit(limit);
  return { kind: "messages" as const, rows };
}
