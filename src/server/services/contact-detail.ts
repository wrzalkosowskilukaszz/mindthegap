/** Everything the contact side panel shows, in one call. */
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { checkSendable, staleness } from "@/lib/contact-rules";
import { foldDiacritics } from "@/lib/normalize";
import { db } from "../db/client.ts";
import {
  companies,
  companySources,
  contactEvents,
  contactEvidence,
  contacts,
  contactVerifications,
  inboundMessages,
  messageAttachments,
  messages,
  notes,
  programs,
  reminders,
} from "../db/schema.ts";
import { getSettings } from "../settings.ts";
import { recentCompanyOutreach, suppressionHits } from "./contacts.ts";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function getContactDetail(id: string) {
  const [c] = await db().select().from(contacts).where(eq(contacts.id, id)).limit(1);
  if (!c) return null;
  const [company] = await db().select().from(companies).where(eq(companies.id, c.companyId)).limit(1);
  const [sources, evidence, verifs, events, noteRows, reminderRows, msgRows, inbound, colleagues, progs] =
    await Promise.all([
      db().select().from(companySources).where(eq(companySources.companyId, c.companyId)),
      db()
        .select()
        .from(contactEvidence)
        .where(eq(contactEvidence.contactId, id))
        .orderBy(desc(contactEvidence.observedAt)),
      db()
        .select()
        .from(contactVerifications)
        .where(eq(contactVerifications.contactId, id))
        .orderBy(desc(contactVerifications.checkedAt)),
      db()
        .select()
        .from(contactEvents)
        .where(eq(contactEvents.contactId, id))
        .orderBy(desc(contactEvents.createdAt))
        .limit(50),
      db().select().from(notes).where(eq(notes.contactId, id)).orderBy(desc(notes.createdAt)),
      db().select().from(reminders).where(eq(reminders.contactId, id)).orderBy(desc(reminders.dueAt)),
      db().select().from(messages).where(eq(messages.contactId, id)).orderBy(desc(messages.createdAt)),
      db()
        .select()
        .from(inboundMessages)
        .where(eq(inboundMessages.contactId, id))
        .orderBy(desc(inboundMessages.receivedAt)),
      db()
        .select({
          id: contacts.id,
          fullName: contacts.fullName,
          departmentLabel: contacts.departmentLabel,
          email: contacts.email,
          title: contacts.title,
          roleCategory: contacts.roleCategory,
          roleFunction: contacts.roleFunction,
          outreachStatus: contacts.outreachStatus,
          lastContactedAt: contacts.lastContactedAt,
          reviewStatus: contacts.reviewStatus,
        })
        .from(contacts)
        .where(and(eq(contacts.companyId, c.companyId), ne(contacts.id, id))),
      db().select().from(programs).where(eq(programs.status, "approved")),
    ]);
  const attachRows = msgRows.length
    ? await db()
        .select()
        .from(messageAttachments)
        .where(
          inArray(
            messageAttachments.messageId,
            msgRows.map((m) => m.id),
          ),
        )
    : [];
  const policy = await getSettings("freshness");
  const outreach = await getSettings("outreach");
  const hits = await suppressionHits({ email: c.email, companyId: c.companyId, contactId: c.id });
  const recent = await recentCompanyOutreach(c.companyId, c.id, outreach.recentCompanyContactDays);
  const facts = { ...c, suppressed: hits.length > 0 };
  const send = checkSendable(facts, policy, {
    requireEligibilityBasis: outreach.requireEligibilityBasis,
    recentCompanyContact: recent[0] ? { at: recent[0].at, who: recent[0].who } : null,
  });

  // Program suggestion: transparent keyword overlap between programme audience/problem and the role.
  const roleText = foldDiacritics(`${c.title ?? ""} ${c.departmentLabel ?? ""}`);
  const suggestions = progs
    .map((p) => {
      const hay = foldDiacritics(
        [
          p.name,
          p.summary.audience?.value,
          p.summary.problem?.value,
          ...(p.summary.keyPoints ?? []).map((k) => k.value),
        ].join(" "),
      );
      let score = 0;
      const why: string[] = [];
      const pairs: [RegExp, RegExp, string][] = [
        [
          /(leader|lider|manager|menedzer|kierown)/,
          /(leader|lider|manager|menedzer|przywodz)/,
          "rozwój menedżerów",
        ],
        [
          /(learning|l&d|szkolen|training|rozwoj|development|akademi)/,
          /(program|warsztat|workshop|rozwoj|development)/,
          "programy rozwojowe",
        ],
        [/(culture|kultur|people|hr|personal)/, /(cultur|kultur|zespol|team|organiz)/, "kultura i zespoły"],
      ];
      for (const [roleRe, progRe, label] of pairs) {
        if (roleRe.test(roleText) && progRe.test(hay)) {
          score++;
          why.push(label);
        }
      }
      return { id: p.id, name: p.name, score, why };
    })
    .sort((a, b) => b.score - a.score);

  return {
    contact: {
      ...c,
      emailCheckedAt: iso(c.emailCheckedAt),
      employmentCheckedAt: iso(c.employmentCheckedAt),
      discoveredAt: c.discoveredAt.toISOString(),
      reviewedAt: iso(c.reviewedAt),
      eligibilityRecordedAt: iso(c.eligibilityRecordedAt),
      lastContactedAt: iso(c.lastContactedAt),
      lastReplyAt: iso(c.lastReplyAt),
      followUpAt: iso(c.followUpAt),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    },
    company: company
      ? {
          ...company,
          createdAt: company.createdAt.toISOString(),
          updatedAt: company.updatedAt.toISOString(),
          lastResearchedAt: iso(company.lastResearchedAt),
          nextResearchAt: iso(company.nextResearchAt),
          sources: sources.map((s) => ({ url: s.url, title: s.title, usedFor: s.usedFor })),
        }
      : null,
    evidence: evidence.map((e) => ({
      ...e,
      observedAt: e.observedAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
    })),
    verifications: verifs.map((v) => ({ ...v, checkedAt: v.checkedAt.toISOString() })),
    events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    notes: noteRows.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString() })),
    reminders: reminderRows.map((r) => ({
      id: r.id,
      dueAt: r.dueAt.toISOString(),
      note: r.note,
      doneAt: iso(r.doneAt),
    })),
    messages: msgRows.map((m) => ({
      id: m.id,
      kind: m.kind,
      language: m.language,
      subject: m.subject,
      status: m.status,
      programId: m.programId,
      createdAt: m.createdAt.toISOString(),
      sentAt: iso(m.sentAt),
      scheduledFor: iso(m.scheduledFor),
      gmailThreadId: m.gmailThreadId,
      attachments: attachRows.filter((a) => a.messageId === m.id).map((a) => a.versionId),
    })),
    inbound: inbound.map((i) => ({
      id: i.id,
      receivedAt: i.receivedAt.toISOString(),
      classification: i.classification,
      fromEmail: i.fromEmail,
      subject: i.subject,
      messageId: i.messageId,
    })),
    colleagues: colleagues.map((x) => ({ ...x, lastContactedAt: iso(x.lastContactedAt) })),
    recentCompanyOutreach: recent.map((r) => ({ ...r, at: r.at.toISOString() })),
    suppression: hits,
    send,
    staleness: staleness(facts, policy),
    programSuggestions: suggestions,
  };
}

export type ContactDetail = NonNullable<Awaited<ReturnType<typeof getContactDetail>>>;
