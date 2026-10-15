# Company research record (JSONL)

One JSON object per line. Every file under `research/companies/` uses this schema.
The app imports these records with `pnpm research:import` and validates them with
the Zod schema in `src/lib/research/company-record.ts`.

The repository is public: company records contain **organisational facts only**.
Never put a person's name, personal email or phone number in these files.

```jsonc
{
  "id": "ing-bank-slaski",                 // kebab-case slug, unique, ASCII
  "name": "ING Bank Śląski S.A.",          // legal name of the POLISH entity when known, else the brand
  "brand": "ING",                          // common brand
  "website": "https://www.ing.pl/",        // official site for the Polish operations (Polish site preferred)
  "domain": "ing.pl",                      // registrable domain used for email research (the Polish entity's email domain if known)
  "group_website": "https://www.ing.com/", // optional, global site; null if same
  "sector": "financial_services",          // enum, see below
  "subsector": "universal bank",           // free text, short
  "hq_country": "NL",                      // ISO 3166-1 alpha-2 of the GROUP headquarters
  "polish_presence": {
    "summary": "Polish universal bank headquartered in Katowice, listed on the Warsaw Stock Exchange.",
    "evidence_url": "https://www.ing.pl/o-nas",   // a page that proves Polish operations (Polish site, KRS entry, careers page in PL, press release)
    "locations": ["Katowice", "Warszawa"]          // optional; [] if unknown
  },
  "parent": "ING Groep N.V.",              // null if none / is the group itself
  "relationship": "subsidiary",            // "independent" | "subsidiary" | "group_parent" | "service_centre" | "branch"
  "relationship_note": null,               // why this entity is kept separate (e.g. a GBS centre that runs its own training)
  "employees_global": { "value": 60000, "as_of": "2024", "source_url": "https://www.wikidata.org/wiki/Q..." },   // or null
  "employees_poland": { "value": 8500, "as_of": "2024", "source_url": "https://...", "approx": true },           // or null when not found
  "size_band": "1000-4999",                // POLISH headcount band if known else global band: "200-999" | "1000-4999" | "5000+" | "unknown"
  "size_basis": "poland",                  // "poland" | "global" | "unavailable": which headcount the band is based on
  "priority_signals": [                    // evidence that structured training / L&D is plausible; [] if none found
    { "signal": "Top Employers Polska 2025 certification", "url": "https://..." }
  ],
  "sources": [                             // every URL actually used; at least one
    { "url": "https://...", "title": "...", "used_for": ["existence", "website", "size", "polish_presence", "parent", "signal"] }
  ],
  "website_check": { "status": 200, "final_url": "https://www.ing.pl/", "checked_at": "2026-10-15" },  // from a real HTTP request
  "notes": null,                           // uncertainties, conflicts, anything unverified
  "researched_at": "2026-10-15",
  "researched_by": "agent:financial"
}
```

## Sector enum

`technology` · `telecom_media` · `financial_services` · `business_services` (SSC/GBS/BPO/IT outsourcing centres) ·
`professional_services` (consulting, audit, legal, advisory) · `pharma_healthcare` · `manufacturing_industrial`
(incl. automotive, chemicals, construction materials) · `energy_utilities` (incl. fuels, mining) ·
`logistics_transport` · `retail_consumer` (retail, FMCG, e-commerce, consumer goods) · `other`

## Rules

1. **No invented data.** Every number has a `source_url` on which that number appears. If not found: `null`.
   Global and Polish headcount are different facts; never copy one into the other.
2. **Website verified by a real HTTP request** (`curl -sSL -o /dev/null -w '%{http_code} %{url_effective}'`). Record status and final URL.
3. **One record per independent Polish employer entity.** Do not list a brand twice. Keep a separate record only
   when a Polish entity plausibly makes its own training decisions (e.g. a large service centre vs. the local sales company),
   and explain it in `relationship_note`.
4. Third-party sources (Wikipedia, Wikidata, rankings, press) are fine for discovery and size; prefer first-party pages for
   Polish presence evidence.
5. Mark anything uncertain in `notes`. Prefer fewer correct records to more doubtful ones.
