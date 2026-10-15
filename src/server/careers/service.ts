/** Reads and changes for the Oferty pracy screen. */
import { and, count, desc, eq, gte, ilike, isNull, ne, or, type SQL, sql } from "drizzle-orm";
import { extractCvKeywords } from "@/lib/jobs/match";
import { db } from "../db/client.ts";
import { companies, contacts, jobOffers, jobSources } from "../db/schema.ts";
import { badRequest, notFound } from "../http.ts";
import { getSettings, saveSettings } from "../settings.ts";
import { careerPrefs, jobsState, rescoreAll } from "./sync.ts";

export const JOB_VIEWS = ["best", "new", "favourites", "saved", "applied", "all"] as const;
export type JobView = (typeof JOB_VIEWS)[number];

async function viewWhere(view: JobView, showFrom: number): Promise<SQL | undefined> {
  const open = isNull(jobOffers.closedAt);
  switch (view) {
    case "best":
      return and(open, sql`${jobOffers.status} in ('new','saved')`, gte(jobOffers.score, showFrom));
    case "new":
      return and(
        open,
        eq(jobOffers.status, "new"),
        gte(jobOffers.firstSeenAt, new Date(Date.now() - 3 * 86_400_000)),
        or(gte(jobOffers.score, Math.max(25, showFrom - 15)), eq(companies.favourite, true)),
      );
    case "favourites":
      return and(open, eq(companies.favourite, true), ne(jobOffers.status, "dismissed"));
    case "saved":
      return eq(jobOffers.status, "saved");
    case "applied":
      return eq(jobOffers.status, "applied");
    default:
      return and(open, ne(jobOffers.status, "dismissed"));
  }
}

export async function listJobs(opts: { view: JobView; q?: string; offset?: number }) {
  const prefs = await careerPrefs();
  let where = await viewWhere(opts.view, prefs.showFrom);
  const q = opts.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    where = and(
      where,
      or(ilike(jobOffers.title, like), ilike(jobOffers.companyName, like), ilike(jobOffers.location, like)),
    );
  }
  const order =
    opts.view === "new"
      ? [desc(jobOffers.firstSeenAt), desc(jobOffers.score)]
      : opts.view === "applied" || opts.view === "saved"
        ? [desc(jobOffers.statusAt)]
        : [desc(jobOffers.score), sql`${jobOffers.postedAt} desc nulls last`];
  const rows = await db()
    .select({
      id: jobOffers.id,
      title: jobOffers.title,
      companyName: jobOffers.companyName,
      companyId: jobOffers.companyId,
      favourite: companies.favourite,
      location: jobOffers.location,
      workplace: jobOffers.workplace,
      employmentType: jobOffers.employmentType,
      postedAt: jobOffers.postedAt,
      firstSeenAt: jobOffers.firstSeenAt,
      closedAt: jobOffers.closedAt,
      score: jobOffers.score,
      match: jobOffers.match,
      status: jobOffers.status,
      url: jobOffers.url,
      source: jobSources.name,
      sourceKind: jobSources.kind,
    })
    .from(jobOffers)
    .innerJoin(jobSources, eq(jobSources.id, jobOffers.sourceId))
    .leftJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(where)
    .orderBy(...order)
    .limit(60)
    .offset(opts.offset ?? 0);

  const counts: Record<string, number> = {};
  for (const v of JOB_VIEWS) {
    const [c] = await db()
      .select({ n: count() })
      .from(jobOffers)
      .leftJoin(companies, eq(companies.id, jobOffers.companyId))
      .where(await viewWhere(v, prefs.showFrom));
    counts[v] = c?.n ?? 0;
  }
  const career = await getSettings("career");
  const state = await jobsState();
  const [boards] = await db()
    .select({
      boards: sql<number>`count(*) filter (where ${jobSources.companyId} is not null and ${jobSources.supported})::int`,
      unsupported: sql<number>`count(*) filter (where not ${jobSources.supported})::int`,
      feeds: sql<number>`count(*) filter (where ${jobSources.companyId} is null and ${jobSources.kind} <> 'manual')::int`,
    })
    .from(jobSources);
  const [checked] = await db()
    .select({
      checked: sql<number>`count(*) filter (where ${companies.careersCheckedAt} is not null)::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(companies)
    .where(and(eq(companies.excluded, false), eq(companies.isDemo, false)));
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    rows: rows.map((r) => ({
      ...r,
      favourite: r.favourite ?? false,
      postedAt: iso(r.postedAt),
      firstSeenAt: r.firstSeenAt.toISOString(),
      closedAt: iso(r.closedAt),
    })),
    counts,
    prefs: {
      roleFamilies: career.roleFamilies,
      locations: career.locations,
      languages: career.languages,
      workTypes: career.workTypes,
      extraKeywords: career.extraKeywords,
      excludeKeywords: career.excludeKeywords,
      showFrom: career.showFrom,
      cvKeywords: career.cvKeywords,
    },
    cv: {
      filename: career.cvFilename,
      uploadedAt: career.cvUploadedAt,
      words: career.cvText ? career.cvText.split(/\s+/).length : 0,
    },
    sync: {
      lastSyncAt: state.lastSyncAt,
      boards: boards?.boards ?? 0,
      unsupported: boards?.unsupported ?? 0,
      feeds: boards?.feeds ?? 0,
      companiesChecked: checked?.checked ?? 0,
      companiesTotal: checked?.total ?? 0,
    },
  };
}

export type JobList = Awaited<ReturnType<typeof listJobs>>;

export async function jobDetail(id: string) {
  const [r] = await db()
    .select({
      o: jobOffers,
      source: jobSources.name,
      sourceKind: jobSources.kind,
      sourceUrl: jobSources.url,
      co: companies,
    })
    .from(jobOffers)
    .innerJoin(jobSources, eq(jobSources.id, jobOffers.sourceId))
    .leftJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(eq(jobOffers.id, id))
    .limit(1);
  if (!r) throw notFound("Oferta nie istnieje");
  let contactsCount = 0;
  if (r.co) {
    const [c] = await db()
      .select({ n: count() })
      .from(contacts)
      .where(and(eq(contacts.companyId, r.co.id), ne(contacts.reviewStatus, "rejected")));
    contactsCount = c?.n ?? 0;
  }
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    ...r.o,
    postedAt: iso(r.o.postedAt),
    firstSeenAt: r.o.firstSeenAt.toISOString(),
    lastSeenAt: r.o.lastSeenAt.toISOString(),
    closedAt: iso(r.o.closedAt),
    statusAt: iso(r.o.statusAt),
    createdAt: r.o.createdAt.toISOString(),
    updatedAt: r.o.updatedAt.toISOString(),
    source: r.source,
    sourceKind: r.sourceKind,
    sourceUrl: r.sourceUrl,
    company: r.co
      ? {
          id: r.co.id,
          name: r.co.brand ?? r.co.name,
          website: r.co.website,
          careersUrl: r.co.careersUrl,
          sector: r.co.sector,
          favourite: r.co.favourite,
          contacts: contactsCount,
        }
      : null,
  };
}

export type JobDetail = Awaited<ReturnType<typeof jobDetail>>;

export async function setJobStatus(
  id: string,
  patch: { status?: "new" | "saved" | "applied" | "dismissed"; note?: string | null },
) {
  const [u] = await db()
    .update(jobOffers)
    .set({
      ...(patch.status ? { status: patch.status, statusAt: new Date() } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      updatedAt: new Date(),
    })
    .where(eq(jobOffers.id, id))
    .returning({ id: jobOffers.id });
  if (!u) throw notFound("Oferta nie istnieje");
}

export async function saveCv(filename: string, text: string) {
  const clean = text.replace(/\s+\n/g, "\n").trim().slice(0, 60_000);
  if (clean.split(/\s+/).length < 30)
    throw badRequest(
      "Nie udało się odczytać tekstu z pliku. Wgraj CV jako PDF lub DOCX z tekstem (nie skan).",
    );
  const career = await getSettings("career");
  await saveSettings("career", {
    ...career,
    cvText: clean,
    cvFilename: filename.slice(0, 200),
    cvUploadedAt: new Date().toISOString(),
    cvKeywords: extractCvKeywords(clean),
  });
  await rescoreAll();
}

export async function removeCv() {
  const career = await getSettings("career");
  await saveSettings("career", {
    ...career,
    cvText: "",
    cvFilename: null,
    cvUploadedAt: null,
    cvKeywords: [],
  });
  await rescoreAll();
}

export async function savePrefs(patch: Record<string, unknown>) {
  const career = await getSettings("career");
  const allowed = [
    "roleFamilies",
    "locations",
    "languages",
    "workTypes",
    "extraKeywords",
    "excludeKeywords",
    "showFrom",
    "cvKeywords",
  ];
  const next = { ...career };
  for (const k of allowed) if (k in patch) (next as Record<string, unknown>)[k] = patch[k];
  await saveSettings("career", next);
  await rescoreAll();
}

export async function addManualJob(input: {
  url: string;
  title: string;
  companyName: string;
  location?: string | null;
  description?: string | null;
}) {
  const [src] = await db()
    .insert(jobSources)
    .values({ kind: "manual", token: "manual", name: "Dodane ręcznie", supported: false, enabled: false })
    .onConflictDoUpdate({ target: [jobSources.kind, jobSources.token], set: { updatedAt: new Date() } })
    .returning({ id: jobSources.id });
  const { scoreJob } = await import("@/lib/jobs/match");
  const prefs = await careerPrefs();
  const norm = input.companyName.trim().toLowerCase();
  const [co] = await db()
    .select()
    .from(companies)
    .where(or(sql`lower(${companies.name}) = ${norm}`, sql`lower(${companies.brand}) = ${norm}`))
    .limit(1);
  const m = scoreJob(
    {
      title: input.title,
      description: input.description ?? "",
      location: input.location ?? null,
      companyName: input.companyName,
      companySector: co?.sector ?? null,
      favourite: co?.favourite ?? false,
    },
    prefs,
  );
  const [row] = await db()
    .insert(jobOffers)
    .values({
      sourceId: src!.id,
      externalId: input.url.slice(0, 300),
      companyId: co?.id ?? null,
      companyName: co ? (co.brand ?? co.name) : input.companyName.trim(),
      title: input.title.trim(),
      location: input.location?.trim() || null,
      description: (input.description ?? "").slice(0, 20_000),
      url: input.url,
      score: m.score,
      match: { reasons: m.reasons, region: m.region, requiredLanguages: m.requiredLanguages, hits: m.hits },
      status: "saved",
      statusAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [jobOffers.sourceId, jobOffers.externalId],
      set: {
        title: input.title.trim(),
        description: (input.description ?? "").slice(0, 20_000),
        updatedAt: new Date(),
      },
    })
    .returning({ id: jobOffers.id });
  return row!.id;
}

/** A ready prompt for ChatGPT / Claude: fit analysis and a short cover note, from the CV and the ad. */
export async function jobPrompt(id: string): Promise<string> {
  const j = await jobDetail(id);
  const career = await getSettings("career");
  const profile = await getSettings("profile");
  const cv = career.cvText
    ? career.cvText.slice(0, 12_000)
    : "(CV not uploaded yet — ask me for my background first.)";
  return `You are a career advisor. Compare my CV with this job offer and answer in Polish.

1. Fit: list the 3 strongest matches and the 3 biggest gaps, quoting the offer.
2. Should I apply? One sentence, honest.
3. Draft a short cover note (max 150 words, in the language of the offer) that uses only facts from my CV. Do not invent experience, numbers or employers.

<job_offer>
Title: ${j.title}
Company: ${j.companyName}
Location: ${j.location ?? "—"}
Link: ${j.url}

${j.description.slice(0, 12_000) || "(no description; open the link)"}
</job_offer>

<my_cv>
${cv}
</my_cv>

My name: ${profile.senderName || "—"}. I am based in Warsaw.`;
}

export async function setFavourite(companyId: string, favourite: boolean) {
  const [u] = await db()
    .update(companies)
    .set({ favourite, updatedAt: new Date() })
    .where(eq(companies.id, companyId))
    .returning({ id: companies.id });
  if (!u) throw notFound("Firma nie istnieje");
  await rescoreAll({ companyId });
}
