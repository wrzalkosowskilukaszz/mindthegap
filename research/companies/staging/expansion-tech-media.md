# Expansion slice: tech, gaming, media, agencies, large professional services

- Researched by: `agent:expansion-tech-media`, 2026-10-15
- Output: `expansion-tech-media.jsonl`, **125 records**, all valid against `CompanyRecord` (0 invalid)
- Below the 200–300 target. Once the large, verifiable names were covered, each further candidate needed several lookups and usually ended with no Polish headcount. The brief said quality over quantity, so I stopped there instead of adding unverified names.

## Records per group

| Group | Records | Sector used |
|---|---|---|
| 1. Tech / IT employers (vendors, R&D hubs, IT services, software houses, fintech and e-commerce tech) | 58 | `technology` |
| 2. Gaming and entertainment (game services, betting/lottery, cinemas, amusement park, localisation and game testing) | 10 | `telecom_media` (Lionbridge: `business_services`) |
| 3. Media (TV, radio, publishers, telecom infrastructure) | 9 | `telecom_media` |
| 4. Marketing, media and creative agencies, plus market research | 18 | `professional_services` |
| 5. Large professional services (consulting, law, audit/tax) and other large employers found during research | 30 | mostly `professional_services`; also `logistics_transport` (DHL, InPost, FedEx, Enter Air), `business_services` (UPS GBS, Devire), `pharma_healthcare` (IQVIA), `retail_consumer` (Rainbow Tours) |

Headcount coverage:
- 82 records have a sourced Polish figure.
- 15 have a global or company-wide figure only.
- 13 have only a published size band (for example "201–500" on an employer profile). For these, `size_band` is set and `employees_*` is null.
- 15 have no number at all. They were kept only because they are plainly large Polish employers, and each says so in `notes`: HPE, IG Group Kraków, Cinema City, Multikino, Bauer Media Polska, Burda Media Polska, Wolters Kluwer Polska, WSiP, Nowa Era, Greenberg Traurig, RZM, Wardyński, DLA Piper, InPost, ZPR Media.

## Sources used

- **ITwiz Best100 2025** (largest IT companies by revenue), for discovery and Polish-entity existence: https://itwiz.pl/najwieksze-firmy-it-w-polsce-w-roku-2025-ranking-itwiz-best100/
- **Bankier.pl "władze-zatrudnienie" pages** (Notoria data), for group or company employment of WSE-listed companies: COMP, Atende, Ailleron, Vercom, Shoper, WASKO, OPTeam, LSI Software, IFIRMA, Creotech, Kino Polska TV, BoomBit, CI Games, Digitree, Votum, Enter Air, Rainbow Tours.
- **Press "Panorama Reklamy" results, 2021–2025** (panoramareklamy.press.pl), for agency headcounts: GPD 384, Dentsu Creative 302, Value Media 206, Havas Creative 126, Foap 100+, Altavia Kamikaze + K2 160, Brand New Galaxy 650.
- **Widoczni social media agency ranking** on PRoto.pl (They 146, Tigers 112). The PR agency ranking showed no PR agency with 100+ staff, so no PR agencies are included.
- **Rzeczpospolita Ranking Kancelarii Prawniczych 2026**:
  - Size article: CMS 200+ lawyers, SK&S 197, Baker McKenzie third, Greenberg Traurig eighth.
  - Regional article: SPCG 113, Olesiński 119.
- **Employer profiles.**
  - aplikuj.pl (fetchable): Publicis, OMD, Unit4, emagine, Lionbridge, Craftware, Exclusive Networks, Egnyte, Librus, Polcom, NTT System, plus size bands.
  - Just Join IT brand stories: N-iX, The Software House, Primaris, Darize, Wavestone.
  - RocketJobs brand story: WPP Media 1,300+, Top Employer 2025.
  - **Caveat:** aplikuj.pl states that parts of its descriptions are AI-generated. Figures taken from it are marked `approx` and flagged in `notes`.
- **First-party company pages**: GFT careers Poland, Asseco Data Systems, Deviniti, WASKO, STX Next, Britenet, Sollers, Altkom Software, VirtusLab, Scalo, DZP, Olesiński, UHY, Accace, Rödl & Partner, Cellnex press release, Amazon PL press release, Baker McKenzie and Dentons office pages.
- **City and investment agency and trade press**:
  - invest-in-wroclaw.pl and wroclaw.pl: DataArt, Ryanair Labs, Unit4, HPE, Scalo.
  - Eurobuild CEE: Tesco Technology, Volvo Tech Hub, Aon.
  - ITwiz: Avenga, Inetum, DXC, GFT.
  - Other: PAIH (Mastercard), Radio Kraków (Energylandia), Rzeczpospolita (Cinema City), PharmaBoardroom (IQVIA), Wirtualnemedia (Performance Group).
- **Wikidata** (SPARQL, P1128), for global headcounts of multinationals. The endpoint was throttled to 1 request/min during the session.
- **Top Employers Institute Poland country pages**: used only as a training-relevant signal (NTT DATA Business Solutions, Inetum, IG Group, DHL eCommerce). The page numbers in those URLs shift as new posts are added.

## Method notes

- **Website check.** Every `website_check` comes from a real curl request. If plain curl did not return 200, the same request was repeated with a browser User-Agent and HTTP/1.1, and the result says so in `notes`. 17 sites still return 403, 429 or an HTTP/2 error to automated requests (e.g. VML, CMS, McKinsey, InPost, STS, LOTTO, Multikino, Wolters Kluwer, Mastercard, Volvo Cars, Unit4). They are recorded as returned, with a note.
- **Polish presence evidence.** `evidence_url` is first-party where possible; otherwise it is a city agency, ranking, employer profile or press page.
- **Lower bounds.** Law-firm figures are lawyers only, and IT figures are often "specialists" (which may include B2B contractors). Both are recorded as lower-bound, `approx` values with a note.
- **Email domains.** Several are assumptions and are marked in `notes`: wppmedia.com, omnicommedia.com, cms-cmno.com, sollers.eu, tietoevry.com, darize.com, scalosoft.com, ig.com, roedl.com, nttdata.com.
- **Personal names.** Law firms are named by their brand or acronym (SK&S, DZP, SPCG, RZM, MDDP), and international firms as "(Warsaw office)", so partner surnames are not spread through the records. The exceptions are Olesiński i Wspólnicy and Wardyński i Wspólnicy, whose brand is the founder's name. No person names, personal emails or phones are in the records. Source URLs whose slugs contain a person's name were replaced by `?p=` short links where possible.

## Explicitly requested names not added, and why

- **Already in the known lists:** Comarch, Asseco, Sii, Software Mind, Netguru, Billennium, Spyrosoft, EPAM, Luxoft, GlobalLogic, SoftServe, Allegro, Google, Microsoft, Intel, Motorola Solutions, Nokia, CD PROJEKT, Techland, 11 bit, People Can Fly, Bloober, Ten Square Games, Huuuge, TVN, Polsat Plus, Agora, Ringier Axel Springer, Wirtualna Polska, EY, Deloitte, PwC, KPMG, Grant Thornton, BDO, Forvis Mazars.
- **Samsung R&D Poland:** its domain samsung.com is already used by Samsung Electronics Poland Manufacturing, and the merge drops a second record on the same domain.
- **Endava:** the only source found is 2023 co-working offices in Gdańsk, Łódź, Warsaw and Wrocław, with no size given. Not kept.
- **Ciklum:** no verifiable Polish office or size.
- **PlayWay:** Bankier/Notoria shows 0 employees on contracts for the company and the group; studios work largely through contractors. Not kept.
- **Agency networks folded into group records:**
  - Wavemaker, Mindshare and EssenceMediacom are in WPP Media Poland.
  - Starcom, Zenith, Leo and Saatchi are in Publicis Groupe Poland.
  - Initiative, UM, OMD and PHD are in Omnicom Media Poland (IPG merged into Omnicom in 2025).
- **Agencies with no size or under 100:** no verifiable Polish size for Ogilvy, McCann, BBDO, DDB, TBWA or Hogarth. Grey (51–200) and Havas Media alone (51–200) are below or unclear.

## Other candidates rejected

- **Size not verifiable or under about 100:**
  - IT and software: Grid Dynamics, Intellias, Sigma Software, Itransition, Dolby Poland, Snowflake (about 100 engineers), Box, JetBrains (about 60 growing to 200), Uber Kraków (2019 data only), Nike Gdańsk tech centre, Toyota Digital Hub, Vulcan, Boldare, Merixstudio, 10Clouds, Decerto, Atman (51–200), Operator Chmury Krajowej (51–200), Senetic (51–200), APN Promise (87 in 2023).
  - Gaming and entertainment: Testronic, Fortuna, Superbet, Admind.
  - Media: Ströer, Telewizja Puls (50+), Telewizja Republika (23).
  - Professional services: Kochański & Partners, White & Case, A&O Shearman (about 60 lawyers), Baker Tilly TPA, RSM, Ipsos, Bain, Hays, Michael Page, Antal, Grafton.
- **Excluded by rule:**
  - Polska Agencja Prasowa: state statutory news agency, treated as a public institution.
  - Centralny Ośrodek Informatyki and Aplikacje Krytyczne: public or state IT bodies.
  - Altkom Akademia, Coders Lab, SDA: training providers, i.e. competitors.
  - Staffing firms' temporary-worker counts (Personnel Service, OTTO): these are not internal staff.
- **Ambiguous or merged:**
  - Solwit now redirects to ALTEN Polska, which is known.
  - gpd.pl is an unrelated developer; the agency is gpd.com.pl.
  - zpr.pl is a hotel and events group; ZPR Media is kept with a caveat.
  - Raven law firm: no official site found.
  - Gremi Media: aplikuj.pl shows an implausible 2,474 group employees.
  - TD SYNNEX: its "10,000" figure is global.
  - Dell Products (Poland) Łódź: the "1,300" figure looks outdated (factory era) and was not used.
  - intive: 2017 data only.

## Not verified / open points

- Many Polish figures are undated self-descriptions (employer profiles, brand pages). The `as_of` field is null where no date was shown.
- **Ownership or HQ details from general knowledge.** Avenga (DE), N-iX (MT), emagine (DK), Accace (SK), Kino Polska (SPI), Altavia, Craftware (Orange group) and the InPost takeover status are all marked in `notes`.
- **Sector judgement calls.**
  - Amazon is set to `technology` as requested, although most Polish staff are in logistics.
  - Mastercard and Aon could be `financial_services`.
  - Lionbridge is `business_services`.
- **Outside the five groups.** Enter Air, Rainbow Tours, IQVIA, DHL, InPost, FedEx and UPS GBS were added as large employers met during the work. They may overlap with the other researchers' lists.
- **Overlap with the other researchers.** Listed companies sourced from Bankier (e.g. COMP, Atende, Shoper, Kino Polska, Enter Air, Rainbow Tours) and Top Employers names may also appear in their output; dedupe on domain.
