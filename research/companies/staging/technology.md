# Technology, telecom and media slice: research log

- Researched by: `agent:technology`, 2026-10-15
- Output: `technology.jsonl`, 60 records (43 `technology`, 17 `telecom_media`)
- Headcount coverage:
  - 27 records have a Polish headcount (9 of them also have a global one).
  - 27 have a global or group headcount only.
  - 6 have no headcount (Emitel, TVN, Canal+ Polska, Grupa Pracuj, OLX Poland, Ocado Technology Poland).
- Priority signals: found for 14 records.

## List-type sources used for discovery

- Wikipedia, "List of companies of Poland" (technology, telecom and media rows): https://en.wikipedia.org/wiki/List_of_companies_of_Poland
- ITwiz Best100 2025, largest IT companies in Poland by IT revenue. Used for software producers, game studios, telecoms and equipment vendors: https://itwiz.pl/najwieksze-firmy-it-w-polsce-w-roku-2025-ranking-itwiz-best100/
- Wikidata SPARQL (https://query.wikidata.org/sparql):
  - Polish companies (P17 = Poland) in software, telecom, media, games, internet and electronics industries with P1128 of 200 or more.
  - Polish subsidiaries of foreign tech groups.
  - Polish companies whose headcount is referenced to the Coface CEE Top 500 ranking. The ranking itself was cited by Wikidata; it was not opened.
- Polish and English Wikipedia infoboxes for headcount and HQ.
- Company careers and location pages for international R&D sites: Nokia, Dynatrace, Sabre, Ocado, Opera, TomTom, Google careers, Samsung Research, Lufthansa Systems Poland, Schibsted & Vend Polska.
- Annual and integrated reports: Orange Polska 2024, Cyfrowy Polsat 2025, P4 Group 2024, Wirtualna Polska 2025, Asseco 2025, CD PROJEKT 2025, Allegro.eu Q2 2026.
- Top Employers Polska: no list was accessible (the search tool on top-employers.com is script-driven). The only certification used is Emitel's own 2026 press release.
- Tried without success:
  - GPW sector index constituents (WIG-informatyka, WIG-telekomunikacja, WIG-media): no constituent list found.
  - Computerworld TOP200 2025: list not found.

## Candidates rejected and why

- **IT services or outsourcing (excluded by the brief):** Netguru, Sii, Billennium, Futurice, Deviniti, Decerto, SoftwareMill, QLOC (game porting and QA services). Transition Technologies MS is covered inside the Transition Technologies group record.
- **IT distributors and integrators:** AB S.A., APN Promise, NTT System, Senetic, Integrated Solutions (an Orange Polska subsidiary).
- **E-commerce retailers:** TME, Oponeo, Displate, which fall in the retail slice.
- **Too small (under about 200 staff):**
  - Ailleron: 138 (2024).
  - CI Games: 153 (2024).
  - Synerise: 160 (2022) or 200 (undated), sources conflict.
- **Polish presence or size not verifiable with the tools left:**
  - Brainly: no headcount after layoffs.
  - Egnyte (Poznań), Snowflake (Warsaw), Uber (Kraków), Atlassian: no verified Polish site.
  - Amazon Development Center (Gdańsk): also overlaps the retail/logistics slices.
  - SAP Polska, Oracle Polska, Dolby (Wrocław).
  - Jeppesen (Gdańsk): ownership changed in 2025.
  - ESET (Kraków), Elsewhere Entertainment (Warsaw).
  - Asseco Data Systems, Atende, Wasko, Vulcan, Comp, Vercom, Shoper, Librus.
  - Toya, Cellnex Poland, Kino Polska TV, Telewizja Puls, Bauer Media Polska.
  - Grupa RMF / Bauer Media Audio Poland: a "480 people" job ad had closed and could not be verified.
  - Grupa ZPR Media: the Wikidata item that carries a 2018 headcount of 2,756 is described as the former state circus agency, so it is ambiguous.
- **In liquidation, no data:** Polskie Radio S.A. w likwidacji. TVP was kept despite its liquidation status because it has a sourced headcount.
- **Folded into group records (one record per employer or brand):**
  - Telewizja Polsat and Interia are inside the Polsat Plus Group record.
  - Eurozet / Radio ZET is inside Agora.
  - Onet is inside Ringier Axel Springer Polska.
  - Ceneo is inside Allegro.
  - GOG is inside CD PROJEKT.
  - Wakacje.pl and Money.pl are inside Wirtualna Polska.
  - UPC Polska (merged into Play) and Multimedia Polska (merged into Vectra) are covered by those records.
- **Kept separate inside Polsat Plus Group:** Polkomtel (Plus) and Netia have their own records because they are separate employers. See `relationship_note` in each record.
- **Outside this slice:**
  - Samsung Electronics Poland Manufacturing, LG Electronics Mława, LG Energy Solution: manufacturing.
  - Revolut, Visa, Euronet: financial services.
  - Aptiv, ABB: industrial.

## Gaps and caveats

- **Search budget:** the shared web-search budget (200 calls per turn across all agents) ran out partway through. After that, research relied only on direct requests to company sites, Wikipedia and Wikidata. This is why the slice has 60 records, below the 65–85 target.
- **Polish headcount missing for most international R&D sites:** Intel Gdańsk, Samsung R&D, Sabre Kraków, Dynatrace Gdańsk, Cisco, Akamai, Ocado, Microsoft, TomTom.
- **Partial Polish headcounts:**
  - Nokia counts Wrocław only (about 5,000); Bydgoszcz adds over 1,000 and Kraków more.
  - Google counts only the Warsaw R&D centre in 2020 (450).
- **Dated or undated figures:**
  - Dated: Huawei (2013), TVP (2018), Polkomtel (2020), Sygnity and Asseco Business Solutions (2021), Ericsson (2021).
  - Undated Wikipedia infobox values: Kamsoft, eSky, Netia, Exatel, Inea, Bloober Team, Huuuge.
  - Each case is flagged in `notes`.
- **Websites returning 403:** 12 sites answered 403 to automated requests (bot protection), including Asseco, Allegro, OLX, eSky, Intel, Ericsson, Motorola Solutions, Cisco and Akamai. The status is recorded as returned.
- **Legal names not verified:** for several multinationals the Polish legal entity name was not confirmed, so the record uses "Brand (Poland)".
- **TVN ownership:** Paramount Skydance completed its takeover of Warner Bros. Discovery in October 2026 (money.pl), and HR/L&D ownership may change.
- **Possible overlaps with other slices:**
  - Cisco Kraków and Motorola Solutions Kraków (finance centre) overlap business_services.
  - Allegro, OLX and eSky overlap retail_consumer.
  - VIGO Photonics overlaps manufacturing_industrial.
  - Lufthansa Systems Poland is a captive IT company of an airline group.
