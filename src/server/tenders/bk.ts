/**
 * Baza Konkurencyjności (bazakonkurencyjnosci.funduszeeuropejskie.gov.pl): the public register where
 * organisations spending EU funds publish requests for quotes. Read through the same public JSON the
 * site's own search page uses: free, no login, no robots.txt restrictions (checked 2026-10-15). The terms
 * ask reusers to name the Ministry as the source, give the date and say when data was processed; the
 * Zapytania tab shows that line. Untrusted input: every field is validated and only text is kept.
 * Contact persons published in announcements are never read or stored.
 */
import { DateTime } from "luxon";
import { z } from "zod";
import { htmlToText } from "../careers/text.ts";
import type { TenderDetail } from "../db/schema.ts";
import type { PoliteFetcher } from "../discovery/fetcher.ts";

export const BK_ORIGIN = "https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl";
export const BK_SOURCE_LINE = "Baza Konkurencyjności, Ministerstwo Funduszy i Polityki Regionalnej";
export const bkUrl = (id: string) => `${BK_ORIGIN}/ogloszenia/${encodeURIComponent(id)}`;

/** Title words the search matches whole; the training category is read in full besides these. */
export const BK_QUERIES = [
  "coaching",
  "coachingu",
  "mentoring",
  "mentoringu",
  "tutoringu",
  "trener",
  "trenera",
  "trenerów",
  "warsztaty",
  "warsztatów",
  "team building",
  "kompetencji miękkich",
  "kompetencje miękkie",
  "menedżerów",
  "kadry zarządzającej",
];

const str = z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string());
const Listing = z.object({
  status: z.literal("OK"),
  data: z.object({
    advertisements: z.array(
      z.object({
        id: z.union([z.number(), z.string()]).transform(String),
        title: str,
        content: str,
        advertiser_name: str,
        publication_date: str,
        submission_deadline: str,
        fulfillment_place: str,
      }),
    ),
    meta: z.object({ total: z.number() }),
  }),
});

export type BkListItem = {
  externalId: string;
  title: string;
  snippet: string;
  advertiser: string;
  place: string | null;
  publishedOn: string | null;
  deadlineAt: Date | null;
};

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
/** Search results highlight the query with <mark>; descriptions may carry HTML or entities. */
const plain = (s: string) => htmlToText(s.replace(/<\/?mark>/gi, ""));

/** "2026-10-23 08:00:00" in Polish time. */
export function bkDate(s: string): Date | null {
  if (!s) return null;
  const d = DateTime.fromSQL(s.trim(), { zone: "Europe/Warsaw" });
  return d.isValid ? d.toJSDate() : null;
}

export class BkError extends Error {}

export async function bkSearch(
  f: PoliteFetcher,
  params: { query?: string; trainingCategory?: boolean; page: number; limit: number },
): Promise<{ items: BkListItem[]; total: number }> {
  const u = new URL("/api/announcements/search", BK_ORIGIN);
  u.searchParams.set("page", String(params.page));
  u.searchParams.set("limit", String(params.limit));
  u.searchParams.set("sort", "publicationDate");
  u.searchParams.append("status[]", "PUBLISHED");
  if (params.trainingCategory) {
    u.searchParams.set("category", "Usługa");
    u.searchParams.set("subcategory", "Usługi szkoleniowe");
  }
  if (params.query) u.searchParams.set("query", params.query);
  const r = await f.get(u.toString(), "api");
  if (!r.ok) throw new BkError(`${r.reason} ${r.status ?? ""}`.trim());
  let json: unknown;
  try {
    json = JSON.parse(r.body);
  } catch {
    throw new BkError("not_json");
  }
  const p = Listing.safeParse(json);
  if (!p.success) throw new BkError("unexpected_shape");
  return {
    total: p.data.data.meta.total,
    items: p.data.data.advertisements.map((a) => ({
      externalId: a.id,
      title: clean(plain(a.title)).slice(0, 500),
      snippet: plain(a.content).slice(0, 2000),
      advertiser: clean(plain(a.advertiser_name)).slice(0, 300) || "—",
      place: clean(a.fulfillment_place).slice(0, 200) || null,
      publishedOn: /^\d{4}-\d{2}-\d{2}$/.test(a.publication_date) ? a.publication_date : null,
      deadlineAt: bkDate(a.submission_deadline),
    })),
  };
}

const Named = z.object({ name: str }).passthrough();
const Detail = z.object({
  status: z.literal("OK"),
  data: z.object({
    advertisement: z.object({
      title: str,
      submission_deadline: str,
      advertisement: z.object({ number: str }).passthrough().optional(),
      advertiser_address_details: z
        .object({
          address: z.object({ locality: str, voivodeship: str }).passthrough().nullable().optional(),
        })
        .passthrough()
        .nullable()
        .optional(),
      orders: z
        .array(
          z
            .object({
              title: str,
              order_items: z
                .array(
                  z
                    .object({
                      description: str,
                      fulfillment_places: z
                        .array(z.object({ country: str, voivodeship: str, locality: str }).passthrough())
                        .optional()
                        .default([]),
                      participation_conditions: z
                        .array(
                          z.object({ description: str, type: Named.nullable().optional() }).passthrough(),
                        )
                        .optional()
                        .default([]),
                    })
                    .passthrough(),
                )
                .optional()
                .default([]),
              evaluation_criteria: z
                .array(z.object({ description: str }).passthrough())
                .optional()
                .default([]),
            })
            .passthrough(),
        )
        .optional()
        .default([]),
      attachments: z.array(Named).optional().default([]),
    }),
  }),
});

export type BkDetail = TenderDetail & { number: string | null; deadlineAt: Date | null };

export async function bkDetail(f: PoliteFetcher, externalId: string): Promise<BkDetail> {
  const r = await f.get(`${BK_ORIGIN}/api/announcements/${encodeURIComponent(externalId)}`, "api");
  if (!r.ok) throw new BkError(`${r.reason} ${r.status ?? ""}`.trim());
  let json: unknown;
  try {
    json = JSON.parse(r.body);
  } catch {
    throw new BkError("not_json");
  }
  const p = Detail.safeParse(json);
  if (!p.success) throw new BkError("unexpected_shape");
  const a = p.data.data.advertisement;
  const multi = a.orders.length > 1;
  const description = a.orders
    .map((o, i) => {
      const body = o.order_items
        .map((it) => plain(it.description))
        .filter(Boolean)
        .join("\n\n");
      return multi ? `Część ${i + 1}: ${clean(o.title)}\n${body}` : body;
    })
    .join("\n\n")
    .slice(0, 20_000);
  const uniq = (xs: string[]) => [...new Set(xs.map(clean).filter(Boolean))];
  const items = a.orders.flatMap((o) => o.order_items);
  const conditions = uniq(
    items.flatMap((it) =>
      it.participation_conditions
        .filter((c) => !/nie (ustanawia|stawia|okre[śs]la) (wymaga|warunk)/i.test(c.description))
        .map((c) => (c.type?.name ? `${c.type.name}: ${c.description}` : c.description)),
    ),
  ).slice(0, 30);
  const places = uniq(
    items.flatMap((it) =>
      it.fulfillment_places.map((pl) =>
        pl.locality || pl.voivodeship ? [pl.locality, pl.voivodeship].filter(Boolean).join(", ") : pl.country,
      ),
    ),
  ).slice(0, 20);
  const addr = a.advertiser_address_details?.address;
  return {
    description,
    conditions: conditions.map((c) => c.slice(0, 1500)),
    criteria: uniq(a.orders.flatMap((o) => o.evaluation_criteria.map((c) => c.description)))
      .slice(0, 15)
      .map((c) => c.slice(0, 800)),
    attachments: uniq(a.attachments.map((x) => x.name)).slice(0, 30),
    places,
    advertiserCity: addr ? [addr.locality, addr.voivodeship].filter(Boolean).join(", ") || null : null,
    number: a.advertisement?.number || null,
    deadlineAt: bkDate(a.submission_deadline),
  };
}
