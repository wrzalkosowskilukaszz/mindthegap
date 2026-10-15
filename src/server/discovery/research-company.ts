/**
 * Research one company from its own public website, bounded by a page budget:
 * homepage → scored internal links (+ sitemap) → extract emails and named people near relevant titles.
 * Stores only what appears verbatim on the pages, with the page URL, a quote and dates.
 */
import { eq } from "drizzle-orm";
import { domainLabel, registrableDomain } from "@/lib/normalize";
import { assessRole, spreadAcrossFunctions } from "@/lib/roles";
import { db } from "../db/client.ts";
import { companies } from "../db/schema.ts";
import { deriveCompanyOutcome } from "../services/companies.ts";
import { type ContactInput, upsertContact } from "../services/contacts.ts";
import { getSettings } from "../settings.ts";
import { aiExtractPeople } from "./ai-extract.ts";
import { type EmailCandidate, extractPage, type PersonCandidate, scoreLink, sitemapUrls } from "./extract.ts";
import type { PoliteFetcher } from "./fetcher.ts";

export type ResearchResult = {
  outcome: string;
  pagesFetched: number;
  pagesFailed: number;
  created: number;
  updated: number;
  skipped: number;
  candidates: { people: number; emails: number };
  newContactIds: string[];
  unavailable: boolean;
  note?: string;
};

type Found = { page: string; publishedAt: string | null; title: string };

const RECENT_DAYS = 365;

export async function researchCompany(
  companyId: string,
  ctx: {
    fetcher: PoliteFetcher;
    runId?: string | null;
    deadline: number;
    maxPages: number;
    maxContacts: number;
  },
): Promise<ResearchResult> {
  const [co] = await db().select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!co) throw new Error("company not found");
  const result: ResearchResult = {
    outcome: "research_incomplete",
    pagesFetched: 0,
    pagesFailed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    candidates: { people: 0, emails: 0 },
    newContactIds: [],
    unavailable: false,
  };
  if (co.excluded) return { ...result, outcome: "excluded" };

  const domains = [co.domain];
  const siteDomain = co.website ? registrableDomain(co.website) : null;
  if (siteDomain && siteDomain !== co.domain) domains.push(siteDomain);

  await db()
    .update(companies)
    .set({ researchStatus: "in_progress", updatedAt: new Date() })
    .where(eq(companies.id, companyId));

  // 1. Homepage (with fallbacks).
  const starts = [co.website, `https://www.${co.domain}/`, `https://${co.domain}/`].filter((u): u is string =>
    Boolean(u),
  );
  let home: { url: string; body: string } | null = null;
  for (const s of [...new Set(starts)]) {
    const r = await ctx.fetcher.get(s);
    if (r.ok) {
      home = { url: r.url, body: r.body };
      break;
    }
    result.pagesFailed++;
    if (r.reason === "robots_disallowed") result.note = "robots.txt nie pozwala na pobranie strony";
  }
  const emails = new Map<string, EmailCandidate & Found>();
  const people = new Map<string, PersonCandidate & Found>();
  const roleBlocks: { block: string; page: string }[] = [];
  const collect = (url: string, html: string) => {
    const ex = extractPage(html, url, domains, [co.brand ?? "", co.name]);
    for (const e of ex.emails)
      if (!emails.has(e.email))
        emails.set(e.email, { ...e, page: url, publishedAt: ex.publishedAt, title: ex.title });
    for (const p of ex.people)
      if (!people.has(p.fullName))
        people.set(p.fullName, { ...p, page: url, publishedAt: ex.publishedAt, title: p.title });
    for (const b of ex.roleBlocks) if (roleBlocks.length < 40) roleBlocks.push({ block: b, page: url });
    return ex;
  };

  if (!home) {
    result.unavailable = true;
    result.outcome = "source_unavailable";
    await finish(companyId, result);
    return result;
  }
  result.pagesFetched++;
  const homeEx = collect(home.url, home.body);
  if (registrableDomain(home.url) && !domains.includes(registrableDomain(home.url)!))
    domains.push(registrableDomain(home.url)!);

  // 2. Candidate pages: links + sitemap, scored.
  const candidates = new Map<string, number>();
  for (const l of homeEx.links) {
    const s = scoreLink(l.url, l.text);
    if (s > 1) candidates.set(l.url, Math.max(candidates.get(l.url) ?? 0, s));
  }
  // The sitemap only supplements a thin homepage (it is mostly articles).
  if (Date.now() < ctx.deadline && candidates.size < 5) {
    const origin = new URL(home.url).origin;
    const maps = (await ctx.fetcher.sitemapsFromRobots(origin)).slice(0, 1);
    const smUrl = maps[0] ?? `${origin}/sitemap.xml`;
    const sm = await ctx.fetcher.get(smUrl, "xml");
    if (sm.ok) {
      let parsed = sitemapUrls(sm.body);
      if (parsed.sitemaps.length) {
        const pick = parsed.sitemaps.find((s) => /page|strony|pl/i.test(s)) ?? parsed.sitemaps[0]!;
        const sub = await ctx.fetcher.get(pick, "xml");
        parsed = sub.ok ? sitemapUrls(sub.body) : { urls: [], sitemaps: [] };
      }
      for (const u of parsed.urls.slice(0, 5000)) {
        const reg = registrableDomain(u);
        if (!reg || !domains.some((d) => d === reg || domainLabel(d) === domainLabel(reg))) continue;
        const s = scoreLink(u, "");
        if (s > 3) candidates.set(u, Math.max(candidates.get(u) ?? 0, s - 0.5));
      }
    }
  }
  const queue = [...candidates.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u);
  const visited = new Set([home.url]);
  for (const url of queue) {
    if (result.pagesFetched >= ctx.maxPages || Date.now() > ctx.deadline) break;
    if (visited.has(url)) continue;
    visited.add(url);
    const r = await ctx.fetcher.get(url);
    if (!r.ok) {
      result.pagesFailed++;
      continue;
    }
    visited.add(r.url);
    result.pagesFetched++;
    collect(r.url, r.body);
  }

  // 3. Optional AI-assisted reading of role-mentioning blocks (every value verbatim-checked by code).
  if (roleBlocks.length > 0 && Date.now() < ctx.deadline) {
    for (const p of await aiExtractPeople(roleBlocks)) {
      if (!people.has(p.fullName)) people.set(p.fullName, { ...p, publishedAt: null, title: p.title });
    }
  }

  result.candidates = { people: people.size, emails: emails.size };

  // 4. Rank and store: relevant people first, then development/HR inboxes, then one fallback.
  const freshness = await getSettings("freshness");
  const now = Date.now();
  const employmentFor = (publishedAt: string | null): ContactInput["employmentStatus"] => {
    if (!publishedAt) return "confirmed_recent"; // listed on the company's live, undated page today
    const age = (now - Date.parse(publishedAt)) / 86_400_000;
    return age <= Math.min(RECENT_DAYS, freshness.staleWarningDays) ? "confirmed_recent" : "dated_evidence";
  };
  const inputs: ContactInput[] = [];
  const peopleSorted = [...people.values()].sort((a, b) => rankPerson(b) - rankPerson(a));
  for (const p of peopleSorted) {
    inputs.push({
      companyId,
      kind: "person",
      fullName: p.fullName,
      title: p.title,
      email: p.email,
      emailOrigin: p.email ? "published_source" : "none",
      roleCategory: p.role.category,
      roleRationale: p.role.label,
      roleFunction: p.role.fn,
      sourcePublishedAt: p.publishedAt,
      employmentStatus: employmentFor(p.publishedAt),
      discoveryMethod: "crawler",
      runId: ctx.runId,
      evidence: [
        {
          kind: "source_page",
          supports: ["name", "role", "employment", ...(p.email ? (["email"] as const) : [])],
          url: p.page,
          title: null,
          quote: p.block.slice(0, 400),
          quoteVerified: true,
          sourcePublishedAt: p.publishedAt,
        },
      ],
    });
  }
  const personEmails = new Set(peopleSorted.map((p) => p.email).filter(Boolean));
  const inboxes = [...emails.values()]
    .filter((e) => !personEmails.has(e.email))
    .sort((a, b) => rankInbox(b) - rankInbox(a));
  let fallbackAdded = false;
  for (const e of inboxes) {
    const devOrHr = e.mailbox === "development" || e.mailbox === "hr" || e.mailbox === "procurement";
    if (e.mailbox === "personal") {
      // A personal-looking address without a nearby name/title: store only when its block shows a relevant role.
      const role = assessRole(e.block);
      if (!role.relevant) continue;
      inputs.push({
        companyId,
        kind: "person",
        fullName: null,
        title: null,
        departmentLabel: null,
        email: e.email,
        emailOrigin: "published_source",
        roleCategory: "uncertain",
        roleRationale: `Adres osobowy w pobliżu: ${role.label}`,
        roleFunction: role.fn,
        sourcePublishedAt: e.publishedAt,
        discoveryMethod: "crawler",
        runId: ctx.runId,
        evidence: [
          {
            kind: "source_page",
            supports: ["email"],
            url: e.page,
            quote: e.block.slice(0, 400),
            quoteVerified: true,
            sourcePublishedAt: e.publishedAt,
          },
        ],
      });
      continue;
    }
    if (!devOrHr && !e.invitation) {
      if (fallbackAdded) continue;
      fallbackAdded = true;
    }
    inputs.push({
      companyId,
      kind: devOrHr || e.invitation ? "department_inbox" : "general_inbox",
      departmentLabel:
        e.mailbox === "development"
          ? "Szkolenia / rozwój"
          : e.mailbox === "hr"
            ? "HR"
            : e.mailbox === "procurement"
              ? "Zakupy"
              : e.invitation
                ? "Kanał ofert dla dostawców"
                : e.mailbox === "recruiting"
                  ? "Rekrutacja"
                  : "Kontakt ogólny",
      email: e.email,
      emailOrigin: "published_source",
      roleCategory: devOrHr || e.invitation ? "departmental_inbox" : "general_routing",
      roleFunction:
        e.mailbox === "development"
          ? "learning"
          : e.mailbox === "hr"
            ? "hr"
            : e.mailbox === "procurement" || e.invitation
              ? "procurement"
              : "other",
      roleRationale:
        e.mailbox === "development"
          ? "Skrzynka związana ze szkoleniami/rozwojem"
          : e.mailbox === "hr"
            ? "Skrzynka działu HR"
            : e.mailbox === "procurement"
              ? "Skrzynka działu zakupów (dostawcy usług, w tym szkoleń)"
              : e.invitation
                ? "Strona zaprasza dostawców do przesyłania ofert"
                : e.mailbox === "recruiting"
                  ? "Skrzynka rekrutacyjna — nie kupuje rozwoju pracowników"
                  : "Adres ogólny firmy",
      sourcePublishedAt: e.publishedAt,
      discoveryMethod: "crawler",
      runId: ctx.runId,
      evidence: [
        {
          kind: "source_page",
          supports: e.invitation ? ["email", "department", "invitation"] : ["email", "department"],
          url: e.page,
          quote: e.block.slice(0, 400),
          quoteVerified: true,
          sourcePublishedAt: e.publishedAt,
          note: e.invitation
            ? "Możliwe zaproszenie do składania ofert — sprawdź treść i zapisz jako podstawę kontaktu, jeśli się zgadza."
            : null,
        },
      ],
    });
  }

  let relevantStored = 0;
  // HR, L&D, procurement and business leaders are separate routes to the training budget: keep one of each first.
  for (const input of spreadAcrossFunctions(inputs, (i) => i.roleFunction ?? "other")) {
    const isRelevant =
      input.roleCategory === "decision_maker" ||
      input.roleCategory === "organizer_influencer" ||
      input.roleCategory === "departmental_inbox";
    if (isRelevant && relevantStored >= ctx.maxContacts) continue;
    const out = await upsertContact(input);
    if (out.action === "created") {
      result.created++;
      result.newContactIds.push(out.contactId);
    } else if (out.action === "updated") result.updated++;
    else if (out.action === "skipped") result.skipped++;
    if (isRelevant && out.action !== "skipped") relevantStored++;
  }

  await finish(companyId, result);
  return result;
}

function rankPerson(p: PersonCandidate): number {
  return (p.role.category === "decision_maker" ? 4 : 2) + (p.email ? 3 : 0);
}

function rankInbox(e: EmailCandidate): number {
  return e.mailbox === "development"
    ? 5
    : e.invitation
      ? 4
      : e.mailbox === "hr"
        ? 3
        : e.mailbox === "procurement"
          ? 2
          : e.mailbox === "generic"
            ? 1
            : 0;
}

async function finish(companyId: string, result: ResearchResult) {
  const freshness = await getSettings("freshness");
  const derived = await deriveCompanyOutcome(companyId);
  const outcome = result.unavailable
    ? "source_unavailable"
    : (derived ?? (result.pagesFetched > 0 ? "no_suitable_contact" : "research_incomplete"));
  result.outcome = outcome;
  const revisitDays =
    outcome === "relevant_contact_found"
      ? freshness.employmentRecheckDays
      : outcome === "source_unavailable"
        ? freshness.revisitSourceUnavailableDays
        : outcome === "person_found_email_unavailable" || outcome === "department_found_no_named_contact"
          ? freshness.revisitNeedsEnrichmentDays
          : freshness.revisitNoContactDays;
  const [co] = await db()
    .select({ attempts: companies.researchAttempts })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  await db()
    .update(companies)
    .set({
      researchStatus: outcome === "relevant_contact_found" ? "researched" : "needs_more_work",
      researchOutcome: outcome as (typeof companies.$inferInsert)["researchOutcome"],
      researchNote: result.note ?? null,
      researchAttempts: (co?.attempts ?? 0) + 1,
      lastResearchedAt: new Date(),
      nextResearchAt: new Date(Date.now() + revisitDays * 86_400_000),
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId));
}
