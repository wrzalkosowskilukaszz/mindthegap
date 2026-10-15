# Industrial slice: research log (agent:industrial, 2026-10-15)

Scope: manufacturing and industrial (incl. automotive, chemicals, metals, electrical, building materials, paper and packaging, furniture, aerospace and defence, construction contractors), energy and utilities, logistics and transport in Poland.

Output: `industrial.jsonl` with 96 records (manufacturing_industrial 62, energy_utilities 14, logistics_transport 20). All lines parse and pass the Zod schema in `src/lib/research/company-record.ts`; ids are unique. No person names or personal contact data.

## Headcount coverage

| Basis | Records |
|---|---|
| Polish headcount recorded | 71 (25 of them are 2018 figures from the Coface CEE Top 500 via Wikidata, flagged "likely outdated" in notes) |
| Global/group headcount only | 17 |
| No headcount found | 8 (PERN, Valeo, Huta Stalowa Wola, POLREGIO, Koleje Mazowieckie, Polskie Porty Lotnicze, DPD Polska, MZA Warszawa) |

34 records have at least one training or development signal with a URL (e.g. ArcelorMittal "Mistrz na starcie / kierownik na starcie", KGHM "Akademia Lidera Giganci", PSE "Akademia Menedżera", TAURON leader development programmes, Volkswagen Poznań Top Employer 2025, VELUX Top Employer 2024, Nowy Styl "Mistrz" programme, Raben "Road Network Academy", LG Energy Solution "Akademia LG" / Learning Center).

## List-type sources used for discovery and size

- Wikipedia, "List of largest Polish companies": the Coface CEE Top 500 (2025 edition, 2023 data) table and the WIG20 table. https://en.wikipedia.org/wiki/List_of_largest_Polish_companies
- Wikidata SPARQL: all items with country = Poland and an employee count (P1128) of 300 or more (about 280 items). Most of the Polish-entity figures are referenced in Wikidata to the Coface CEE Top 500 2019 booklet (2018 data); a few to the Coface CEE Top 500 2024 edition. Each number used was re-checked against the item's entity data.
- Wikidata SPARQL by label for parent groups' global headcount (Stellantis, Volkswagen, Toyota, Siemens, Bosch, Saint-Gobain, Leonardo, Flex and others).
- Web searches (until the shared search budget ran out) as pointers to first-party company pages. Every number in the file was then read on the cited page by a direct request.
- Not used: Top Employers Polska (the certified-companies list is rendered by JavaScript), Lista 500 Rzeczpospolitej, Polityka 500, PAIH and special economic zone investor lists (not reached before the search budget ran out).

## Deduplication and entity decisions

- PGNiG and Grupa LOTOS merged into ORLEN in 2022, so they are covered by the `orlen` record. Energa (ORLEN subsidiary) is kept separate because it has its own careers portal and development initiatives.
- The PKP group is split into PKP S.A. (group parent), PKP Intercity, PKP PLK and PKP CARGO. Each runs its own workforce and HR. PKP S.A.'s Coface figure is probably consolidated and overlaps with the others.
- Bosch: `bosch-polska` uses the Bosch-Group-in-Poland figure (9,800, which includes BSH). BSH is kept separate because it runs its own factories and HR.
- Stellantis: Tychy (FCA Poland S.A.) and Gliwice (Stellantis Gliwice Sp. z o.o.) are separate companies and plants, so they have separate records. FCA Services Polska is a service centre and is excluded.
- PGZ and Huta Stalowa Wola: HSW is kept separately because it publishes its own training programme. HSW's PGZ ownership is general knowledge and was not verified on a page.
- The brief's "International Paper Kwidzyn" has been part of MM Board & Paper (Mayr-Melnhof) since 2021, per the MM site, so it is recorded as `mm-kwidzyn`. Sylvamo's Europe page lists only its French and Swedish mills, so Sylvamo was not used.
- Grenevia S.A. changed its name back to FAMUR S.A. (KRS registration 6 October 2026, per grenevia.com), so it is recorded as `famur`.
- Brand-level records, used where Polish legal entities could not be verified: MAN, Valeo, Hitachi Energy, VELUX, Saint-Gobain, Heidelberg Materials, Alstom, Raben, DSV, Kuehne+Nagel, FM Logistic.
- Construction contractors (Budimex, Skanska, STRABAG, Mostostal Warszawa) are placed in `manufacturing_industrial`, per the slice brief.

## Candidates rejected or not added (and why)

- Whirlpool Polska: Whirlpool's European appliance business is now Beko Europe. Beko announced the closure of the Wrocław fridge plant and of production in Łódź (wroclaw.pl, 05.09.2024). The current Polish entity and headcount were not verified.
- Mercedes-Benz Manufacturing Poland (Jawor): no reachable Polish website (mercedes-benz-jawor.pl was refused by the proxy; mercedes-benz.pl gave an HTTP/2 error). Wikidata gives 1,384 (2023). This is a gap.
- Aptiv (Kraków, Jeleśnia, Gdańsk): the only Poland figure came from a press article that now returns 404. Not added.
- ZF (zf.com and the job-board profile return 403) and ABB Polska (new.abb.com did not respond): no verified Polish data. ABB's Kraków GBS belongs to the business_services slice anyway.
- Pratt & Whitney Rzeszów (wskrz.com: TLS certificate chain error) and Pratt & Whitney Kalisz (wskkalisz.pl: proxy refused the connection): not verifiable this pass.
- GE Aerospace Poland, Kongsberg (kongsberg.com 403), Collins Aerospace (403), Safran (403): not researched or not verifiable.
- Nexteer (Tychy), Bridgestone (Poznań, Stargard), Scania (Słupsk), Volvo Polska, Volkswagen Motor Polska: only dated or partial figures found. Bridgestone's and Volvo's Polish service centres are out of scope.
- PCC Rokita (site reset the connection), Celsa Huta Ostrowiec (sites unreachable), NGK Ceramics Polska and Pfleiderer (sites did not respond), Swiss Krono (403), Cersanit (403): no first-party verification possible.
- Pilkington Polska, Cemex Polska, Black Red White, Polimex Mostostal, Holcim Polska, Selena, Wienerberger, Stora Enso (403), Guardian (404), Knauf (403): insufficient verified data in the time available.
- Smurfit Westrock: Polish locations page found (Białystok, Gdańsk, Pruszków, Tczew, Warszawa) but no Poland headcount or entity data. This is a gap.
- InPost (inpost.pl 403), DHL in Poland (dhl.com and dhlparcel.pl did not respond), FedEx, GLS, UPS: no verified Polish data. InPost and DHL are notable gaps.
- Amazon Fulfillment Poland: excluded per the brief (likely covered by another slice). aboutamazon.pl is reachable.
- Polska Spółka Gazownictwa (psgaz.pl 403, ORLEN group), ZE PAK, PGE Energetyka Kolejowa (part of PGE), Circle K Polska and Shell Polska (retail and service-centre heavy): not added.
- Port Gdańsk, Baltic Hub (403), Port Gdynia (no response), Polska Żegluga Morska (polsteam.com no response), Metro Warszawskie (TLS error), MPK Wrocław, LOT AMS, Enter Air (403): no headcount, smaller, or not reachable.

## Known weaknesses

- 25 Polish headcounts are 2018 Coface figures (via Wikidata), and several first-party figures are undated. The `as_of` and `notes` fields say so for each record.
- 5 websites did not return 200 to automated requests: Grupa Azoty (403), Stellantis (403), Schneider Electric (403), Saint-Gobain (403) and Electrolux (no response). For these, Polish presence evidence is a Wikidata item, the Wikipedia/Coface table, a careers subdomain or a press article. Veolia's pages returned 200 during research but 403 on the final re-check.
- Some descriptive facts are marked "general knowledge, not verified on a page" in `notes`: Enea as Bogdanka's parent, CAF as Solaris's owner, Ferrovial and Budimex, IKEA Industry within Ingka, and the Qemetica/CIECH rebrand. Check these before outreach.
- Email domains are the site domains unless the Polish entity's domain was evident. They are not verified mail domains.
