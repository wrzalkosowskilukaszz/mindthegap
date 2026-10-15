# Business & professional services slice: research log

- Output: `services.jsonl`, 76 records (68 `business_services`, 8 `professional_services`)
- Researched by `agent:services` on 2026-10-15
- Every line parses as JSON, all ids are unique, and enums match `SCHEMA.md`.
- Every URL in the file was requested on 2026-10-15. 198 of the 218 unique URLs returned 200. The other 20 are bot blocks (403/429) or the two cases noted below.

## Headcount coverage

| Coverage | Records |
|---|---|
| Polish headcount (`employees_poland`) | 58 |
| Global headcount only | 17 |
| No headcount | 1 (Luxoft Poland) |

- **Ranges.** 20 Polish figures are the **lower bound of an ABSL range**, marked `approx: true` with the range given in `notes`. They come from the ABSL "Business Services Sector in Poland 2025" report (Table 1.5, Q1 2025) or from the City of Katowice 2025 sector report built on ABSL data (Tables 5.1–5.2).
- **Older figures.** 7 Polish figures date from 2021 or earlier, each with its year in `as_of`: BBH 2014, Standard Chartered 2021, Commerzbank 2016, HEINEKEN GSS ~2015, GlobalLogic 2021, ALTEN 2021, AMS 2016.
- **Undated figures.** Two Polish figures come from undated employer profiles and have `as_of: "undated"`: Lufthansa GBS and PMI Service Center Europe.
- **Global figures.** Most come from the Wikipedia infobox `num_employees` (with year), some from the company's own pages, and Nordea's from Wikidata P1128.

## List sources used for discovery

- ABSL member directory: https://absl.pl/en/membership/members (265 members, with logo alt text and links).
- ABSL, *Business Services Sector in Poland 2025* (PDF hosted by Invest in Lodz): https://invest.lodz.pl/files/invest/public/ABSL-2025-EN.pdf. Table 1.5 ranks the largest investors by headcount.
- City of Katowice, *Sektor usług biznesowych w Katowicach 2025* (ABSL data): https://invest.katowice.eu/wp-content/uploads/2025/12/Katowice-2025-PL-251210.pdf. Tables 5.1–5.2 list the largest investors and centres.
- Invest in Wroclaw sector page, which lists the largest BSS centres: https://invest-in-wroclaw.pl/wroclaw-business-services-sector-growth-2026
- City pages and press: wroclaw.pl, Radio Kraków/PAP, Bankier.pl, eFinancialCareers, Eurofound restructuring factsheets, Careers in Poland employer profiles and university careers-office employer cards.
- I checked the Kraków city BSS reports (dlabiznesu.krakow.pl) but they contain no employer-level tables.

## Candidates rejected, and why

- **Pandora SSC (Warsaw):** only about 140–170 employees, below the threshold.
- **WNS (Gdynia):** about 150 employees.
- **Northern Trust:** the only Polish evidence I found was an aggregator profile (businessofgcc.com), which I do not trust.
- **Third-party aggregator figures:** I did not use businessofgcc.com figures for any record because they are internally inconsistent.
- **Not clearly separate service-centre entities, or no verifiable size (manufacturing or consumer parents are covered by other slices):**
  - ABB GBS Kraków: 900+ in 2016, legal entity not verified.
  - PepsiCo GBS Kraków: only job-cut news.
  - Kingfisher (KFS), Koch Business Solutions, HPE Global Business Center Wrocław (website unreachable, data from 2010), ArcelorMittal and TD SYNNEX Katowice centres.
- **Mainly a bank or insurance branch, or part of another slice:**
  - Danske Bank and SEB Polish branches (corporate banking).
  - Santander Global Operations (site unreachable).
  - ERGO Hestia, which belongs to the financial slice. I did keep ERGO Technology & Services as a separate tech hub.
- **Technology slice:** Comarch, Asseco, Kamsoft, WASKO, Sabre, Nokia, Motorola, Google and Cisco are product or R&D companies, not outsourcing providers.
- **Law firms:** I found no evidence of 200+ staff in Poland. DZP states 170 experts, the SK&S page gives practice sizes only, and the CMS and Dentons sites block scripted requests.
- **McKinsey, BCG and Bain (Warsaw):** sites timed out or blocked, and no Polish headcount found.
- **Baker Tilly TPA, RSM Poland, Rödl & Partner:** no Polish headcount on their sites.
- **Hays, Gi Group, CBRE, JLL, Lionbridge, DXC, Computacenter, Avenga, Xceedance, ITDS, Scalo, Connectis, JIT Team, Hicron, Britenet:** no Polish headcount or no Polish evidence found. Gi Group's and CBRE's sites failed TLS or bot checks.

## Gaps and uncertainties

- **Search budget:** the shared web-search budget ran out mid-task. After that I only fetched known official pages directly. As a result some large centres have no Polish headcount, and the Big Four and similar firms have few L&D signals.
  - Records without a Polish headcount: Deloitte, IBM, TCS, Cognizant, Luxoft, SoftServe, staffing firms (internal staff), ISS, International Paper GBSC.
  - Only 17 records have `priority_signals`.
- **Legal entity names:** often not verified. In those cases `name` is the brand plus a qualifier, e.g. "UBS (Polish business solutions centres)". Verified entity names include J.P. Morgan Poland Services Sp. z o.o., Accenture Sp. z o.o., Vattenfall IT Services Poland Sp. z o.o., Netguru S.A., Onwelo Sp. z o.o. and Miquido Sp. z o.o. Sp. k.
- **Conflicting figures**, recorded in `notes`:
  - Teleperformance: ABSL 5,000–6,000 vs 1.7K on its own Polish page.
  - Atos: ABSL 6,000–8,000 vs "over 4,000" on its own page.
  - PwC: the Service Delivery Center has >5,000, but there is no total for PwC in Poland.
- **Partial coverage:** ABSL and Katowice ranges for some firms (Fujitsu, Euvic, Arteria, Future Processing, TMF, Keywords, HireRight, Vialto, ista, Rockwell, Oasis) cover Katowice/GZM only, so the Polish totals are likely higher. The Oasis Group match to the ABSL entry is inferred from its name and HQ country.
- **Possible overlaps with other slices:**
  - These records sit alongside a parent-company record elsewhere, as intended, each with a `relationship_note`: ING Hubs Poland next to ING Bank Śląski (financial), Carlsberg Shared Services next to Carlsberg Polska, and PMI Service Center Europe next to Philip Morris Polska (both pharma-consumer). Aptiv's Kraków Technical Center may also appear in the manufacturing slice.
  - Polish software houses may overlap with the technology slice: Software Mind, Lingaro, Spyrosoft, Netguru, Onwelo, Miquido, Future Processing, Billennium.
- **Website checks (`website_check.status`):** 9 sites return 403 to scripted requests (UBS, Euroclear, EPAM, Infosys BPM, TCS, GlobalLogic, ALTEN, PwC, AMS), and Fujitsu returns 429. The SoftServe Polish site path returned 404 once during the URL sweep.
- **Personal data:** none in the file. One source URL with a person's name in the slug was replaced with another source.
