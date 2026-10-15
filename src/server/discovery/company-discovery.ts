/**
 * Finding new companies beyond the initial universe, from Wikidata (free, structured, CC0):
 * organisations located in Poland with a recorded headcount ≥ threshold and an official website.
 * Each new company keeps the Wikidata item as its source and starts in the research queue.
 */
import { inArray } from "drizzle-orm";
import { registrableDomain, slugify } from "@/lib/normalize";
import { sizeBandFor } from "@/lib/research/company-record";
import { db } from "../db/client.ts";
import { companies, companySources } from "../db/schema.ts";
import { httpFetch } from "../providers/http.ts";
import type { Sector } from "../settings.ts";

const SPARQL = (minEmployees: number) => `
SELECT ?item ?itemLabel ?website ?employees ?date (SAMPLE(?industryLabel) AS ?industry) WHERE {
  { ?item wdt:P17 wd:Q36 . } UNION { ?item wdt:P159 ?hq . ?hq wdt:P17 wd:Q36 . }
  ?item wdt:P856 ?website ;
        p:P1128 ?st .
  ?st ps:P1128 ?employees .
  OPTIONAL { ?st pq:P585 ?date . }
  FILTER(?employees >= ${minEmployees})
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved . }
  OPTIONAL { ?item wdt:P452 ?ind . ?ind rdfs:label ?industryLabel . FILTER(LANG(?industryLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "pl,en". }
}
GROUP BY ?item ?itemLabel ?website ?employees ?date
LIMIT 3000`;

type Binding = { item: { value: string }; itemLabel: { value: string }; website: { value: string }; employees: { value: string }; date?: { value: string }; industry?: { value: string } };

const SECTOR_RULES: [RegExp, Sector][] = [
  [/bank|insur|financ|invest|payment|credit|leasing|asset/i, "financial_services"],
  [/telecom|media|broadcast|television|publishing|radio/i, "telecom_media"],
  [/software|information technology|internet|video game|computer|electronics|semiconductor/i, "technology"],
  [/pharma|health|hospital|medical|biotech|diagnost/i, "pharma_healthcare"],
  [/retail|food|beverage|consumer|cosmetic|clothing|fashion|brew|dairy|confection|tobacco|restaurant/i, "retail_consumer"],
  [/energy|electric|oil|gas|petroleum|coal|mining|utility|power/i, "energy_utilities"],
  [/logistic|transport|rail|airline|shipping|courier|port|postal/i, "logistics_transport"],
  [/consult|audit|legal|accounting|professional/i, "professional_services"],
  [/outsourc|business service|shared service/i, "business_services"],
  [/manufactur|automotive|chemical|steel|metal|machinery|construction|engineering|aerospace|defen[cs]e|furniture|paper|glass/i, "manufacturing_industrial"],
];

export function sectorFromIndustry(s: string | null | undefined): Sector {
  if (!s) return "other";
  for (const [re, sec] of SECTOR_RULES) if (re.test(s)) return sec;
  return "other";
}

export type DiscoveredCompany = { name: string; domain: string; website: string; employees: number; asOf: string | null; wikidata: string; industry: string | null; sector: Sector };

export async function fetchWikidataCandidates(minEmployees: number): Promise<DiscoveredCompany[]> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(SPARQL(minEmployees))}`;
  const res = await httpFetch(url, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": "MindTheGapOutreachStudio/1.0 (https://leadersmindthegap.com/)" },
    timeoutMs: 90_000,
  });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  const json = (await res.json()) as { results: { bindings: Binding[] } };
  const byDomain = new Map<string, DiscoveredCompany>();
  for (const b of json.results.bindings) {
    const domain = registrableDomain(b.website.value);
    const employees = Math.round(Number(b.employees.value));
    if (!domain || !Number.isFinite(employees)) continue;
    if (/^Q\d+$/.test(b.itemLabel.value)) continue; // no label
    const prev = byDomain.get(domain);
    const asOf = b.date?.value?.slice(0, 4) ?? null;
    if (prev && (prev.asOf ?? "") >= (asOf ?? "")) continue;
    byDomain.set(domain, {
      name: b.itemLabel.value,
      domain,
      website: b.website.value,
      employees,
      asOf,
      wikidata: b.item.value.replace("http://", "https://"),
      industry: b.industry?.value ?? null,
      sector: sectorFromIndustry(b.industry?.value),
    });
  }
  return [...byDomain.values()].sort((a, b) => b.employees - a.employees);
}

/** Adds up to `max` new companies matching the discovery settings. Returns the ids added. */
export async function discoverCompanies(opts: {
  max: number;
  minEmployees: number;
  sectors: Sector[];
  excludedDomains: string[];
}): Promise<{ added: string[]; considered: number; skippedKnown: number; source: string }> {
  if (opts.max <= 0) return { added: [], considered: 0, skippedKnown: 0, source: "wikidata" };
  const candidates = await fetchWikidataCandidates(opts.minEmployees);
  const domains = candidates.map((c) => c.domain);
  const known = new Set<string>();
  for (let i = 0; i < domains.length; i += 500) {
    const rows = await db()
      .select({ d: companies.domain })
      .from(companies)
      .where(inArray(companies.domain, domains.slice(i, i + 500)));
    for (const r of rows) known.add(r.d);
  }
  const excluded = new Set(opts.excludedDomains.map((d) => d.toLowerCase()));
  const added: string[] = [];
  let skippedKnown = 0;
  for (const c of candidates) {
    if (added.length >= opts.max) break;
    if (known.has(c.domain)) {
      skippedKnown++;
      continue;
    }
    if (excluded.has(c.domain)) continue;
    if (c.sector !== "other" && !opts.sectors.includes(c.sector)) continue;
    // Website must answer (quick check, GET to respect servers that reject HEAD).
    let status = 0;
    let finalUrl = c.website;
    try {
      const r = await httpFetch(c.website, { redirect: "follow", timeoutMs: 15_000, headers: { "User-Agent": "Mozilla/5.0 (compatible; MindTheGapOutreachBot/1.0)" } });
      status = r.status;
      finalUrl = r.url || c.website;
      await r.body?.cancel().catch(() => {});
    } catch {
      status = 0;
    }
    if (status < 200 || status >= 400) continue;
    const [row] = await db()
      .insert(companies)
      .values({
        slug: `${slugify(c.name)}-${c.domain.replace(/\./g, "-")}`.slice(0, 90),
        name: c.name,
        website: c.website,
        domain: c.domain,
        sector: c.sector,
        subsector: c.industry,
        polishPresenceSummary: "Wikidata: organizacja z siedzibą lub krajem w Polsce (do potwierdzenia na stronie firmy).",
        polishPresenceUrl: c.wikidata,
        employeesGlobal: { value: c.employees, asOf: c.asOf, sourceUrl: c.wikidata },
        sizeBand: sizeBandFor(c.employees),
        sizeBasis: "global",
        origin: "discovery",
        researchStatus: "queued",
        websiteCheck: { status, finalUrl, checkedAt: new Date().toISOString().slice(0, 10) },
        researchedBy: "discovery:wikidata",
      })
      .onConflictDoNothing()
      .returning({ id: companies.id });
    if (!row) continue;
    await db()
      .insert(companySources)
      .values({ companyId: row.id, url: c.wikidata, title: `Wikidata: ${c.name}`, usedFor: ["existence", "website", "size", "polish_presence"], accessedAt: new Date().toISOString().slice(0, 10) })
      .onConflictDoNothing();
    added.push(row.id);
  }
  return { added, considered: candidates.length, skippedKnown, source: "wikidata" };
}
