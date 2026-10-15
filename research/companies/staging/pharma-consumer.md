# Research log: pharma/healthcare and retail/consumer (agent:pharma-consumer)

Date: 2026-10-15. Output: `pharma-consumer.jsonl` (81 records: 32 `pharma_healthcare`, 49 `retail_consumer`).

## Coverage at a glance

- Polish headcount found: 31 records. Global (group) headcount only: 45. No headcount: 5 (Medicover Polska, Diagnostyka, RTV Euro AGD, Allegro, JTI Poland).
- At least one L&D or Top Employers signal: 44 records.
- Website check: 66 returned 200. 13 returned 403 (bot protection): Celon Pharma, Bayer, Lilly, BD, Hebe, Kaufland, Carrefour, Makro, Media Expert, RTV Euro AGD, Decathlon, Leroy Merlin, Allegro. JTI returned 429 (Vercel checkpoint) and neuca.pl returned 502. Bot protection was never bypassed. For these records, Polish presence comes from a readable alternative: a careers subdomain, the INFARMA list, a Top Employers profile or Wikipedia.

## List-type sources used for discovery

| Source | URL | Use |
|---|---|---|
| Top Employers Institute: certified companies, Poland (74 employers, 5 result pages) | https://www.top-employers.com/search-top-employers/?_employer_country=poland&_paged=1 | Discovery and the Top Employers signal (company profile URLs) |
| INFARMA member list (innovative pharma employers) | https://www.infarma.pl/o-infarmie/firmy-czlonkowskie/ | Discovery, Polish entity names, Polish presence |
| Wikipedia: List of companies of Poland | https://en.wikipedia.org/wiki/List_of_companies_of_Poland | Discovery of Polish retail and FMCG companies and their HQ towns |
| Polish and English Wikipedia infoboxes; Wikidata (SPARQL) | various, cited per record | Headcount (dated) and parent checks |

Tried but not usable:
- PZPPF (pzppf.pl): the proxy refused the connection.
- GPW Benchmark sector index composition: rendered by JavaScript, so the constituents could not be read.
- Wikipedia "largest companies in Poland" lists: these pages do not exist (404).
- Lista 500 Rzeczpospolitej, Polityka 500 and Great Place to Work Polska: not consulted (paywall or time).

## Candidates rejected or not included, and why

- **Polfa Tarchomin**: TLS certificate verification failed on every host variant, so the website is unverified. No headcount found.
- **Coca-Cola HBC Polska**: the Poland and Baltics site serves only a bot "Challenge Validation" page, so there was no readable Polish evidence.
- **PepsiCo Polska**: pepsico.pl was unreachable (proxy 502) and pepsico.com/pl returned 404.
- **Unilever Polska, Nestlé Polska, Mars Polska**: the Polish sites return 403 and no other Poland evidence was found in time. These are strong candidates to add after a manual check.
- **British American Tobacco Polska**: bat.pl belongs to an unrelated Polish building-materials chain called BAT, and batpolska.pl has a TLS name mismatch. No Polish BAT site was found.
- **Dr.Max Polska, Super-Pharm Poland, H&M Poland**: 403 and no headcount.
- **Bioton, Inglot, Ziaja, Smyk, ALAB laboratoria**: no headcount evidence found. ALAB's and Smyk's careers subdomains were unreachable.
- **Synevo**: part of the Medicover group (Wikidata), so not listed separately. This is noted in the Medicover record.
- **Orbis (hotels)**: orbisgroup.com is an unrelated firm (Orbis Holding Group), and the Polish hotel operator could not be verified.
- **Not researched (time)**:
  - INFARMA members AbbVie, Almirall, Amgen, Astellas, Berlin-Chemie/Menarini, Biogen, BMS, Gilead, Ipsen, Merck Sp. z o.o., Takeda, UCB. Their Polish affiliates may be under 200 people (unverified).
  - Top Employers Poland entries HiPP Polska, La Lorraine Polska, Mleczarnia Turek, PUMA Polska, Stock Polska, WS Audiology Poland.

## Gaps and things to verify

- **Polish headcount that is dated or limited in scope**:
  - Grupa Żywiec: 2012.
  - Kaufland: January 2021.
  - IKEA: FY2021, and it covers all 12 IKEA companies in Poland.
  - Żabka: 2023, corporate office only. The stores are franchised.
  - Grupa Muszkieterów: central office only. The stores are independently owned.
  - Lux Med: the Wikipedia figure may cover only LUX MED Sp. z o.o.
- **Global figures that are old**: OBI (2015) and Neuca (2018, Wikidata).
- **CCC**: corporate.ccc.eu now redirects to MODIVO S.A. (Polkowice). Confirm the corporate rename in KRS.
- **Parents not confirmed on a fetched page** (parent left null or flagged in notes):
  - MAKRO Polska (METRO).
  - IKEA Retail (Ingka).
  - Rossmann Polska.
  - Media Expert (TERG): ownership not verified.
  - RTV Euro AGD (Euro-net): ownership not verified.
  - Selgros (Transgourmet): inferred from site navigation.
  - LOTTE Wedel (Lotte): inferred from the entity name.
  - Kompania Piwowarska (Asahi): inferred from the careers job-board domain.
- **Polish legal names**: not confirmed for several entities, so the brand or the Top Employers display name is used. This applies to Teva, Sandoz, Aflofarm, USP Zdrowie, Pelion, Enel-Med, Pepco, Hebe, Żabka Polska, Lidl, Netto, Stokrotka, Selgros, Rossmann, Castorama, Action, OBI, Animex, Cedrob and McDonald's.
- **Email domains**: `domain` uses an email domain actually seen on the company's pages where one was found. Examples: jeronimo-martins.com (Biedronka), marketdino.pl (Dino), rossmann.com.pl, chiesi.com, astrazeneca.com, sanofi.com, amica.com.pl, ccc.eu. In every other record `domain` is the website domain. Kompania Piwowarska's careers page also shows asahibeer.pl.
- **Possible overlaps with other slices**:
  - Business services: service and GBS centres of GSK, Bayer, Novo Nordisk, Danone, PMI and Sandoz.
  - Manufacturing: Amica, PMI's factory, IKEA factories, P&G plants, Mondelez plants.
  - Technology: Allegro.
  - Each record holds one entity per brand. Service centres are not included.
- **Multinational pharma affiliates**: Polish headcount was rarely published (found only for AstraZeneca, GSK, MSD and Fresenius Kabi). Size bands for the others reflect group headcount.
