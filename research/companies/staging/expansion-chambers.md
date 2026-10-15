# Expansion: chambers, associations and investor lists (agent:expansion-chambers)

Researched 2026-10-15. Output: `expansion-chambers.jsonl`, **111 records, 0 invalid** against `CompanyRecord` (validation command from the brief).

## Sources used for discovery

Public member or investor lists only. No logins, no paywalls, no LinkedIn.

| Directory | Records citing it |
|---|---|
| AmCham Poland member list (amcham.pl/memberships) | 43 |
| ABSL member directory (absl.pl/en/membership/members) | 41 |
| CCIFP French-Polish Chamber member catalogue | 20 |
| Swiss Chamber Poland member list and profiles | 11 |
| Invest in Wroclaw top investors / companies list | 11 |
| Italian Chamber (CCIIP) membership directory | 3 |
| NPCC (Netherlands-Polish Chamber) member profiles | 3 |
| KSSE (Katowice Special Economic Zone) investor list | 3 |
| AHK Polen premium members | 1 |
| PIIT member list | 1 |

Some records cite more than one directory. Evidence of presence in Poland and headcounts come from the company's own Polish pages, from investor-service pages (wroclaw.pl, PAIH), from press articles (money.pl, forsal.pl, Interia, TVP Info, Eurobuild) and from job-board employer profiles (aplikuj.pl).

**Lists I tried but could not use:**
- BPCC: TLS certificate error. I did not bypass it.
- nlchamber: HTTP 403. I used npcc.pl instead.
- Japanese chamber (JCCI): HTTP 502.
- SPCC: the member list is rendered by JavaScript only.
- pracuj.pl: every page answers 403 to scripts and to the fetch tool. Figures that only appear there are mentioned in `notes` as "reportedly" and never recorded as headcounts.

**Note on the KSSE investor PDF:** it contains contact persons' names, emails and phone numbers. I used company names only and copied no contact data.

## Scope applied
- Owner's scope change applied. Big law and advisory firms that appear in chamber lists are included: A&O Shearman, CMS, Dentons, Baker McKenzie, Wardyński, SK&S, DZP, RZM, Kochański & Partners, McKinsey and Crido. Some firm names are shortened to brand form so that no partner names appear beyond the firm's own name.
- Excluded:
  - companies on the known lists;
  - training or coaching sellers (for example, Antal was dropped);
  - public bodies, associations and small representative offices;
  - companies without a verifiable Polish operation or size (about 50 candidates rejected, for example Edenred, Danske Bank, Dell, SAP, Mastercard, FedEx and Colliers);
  - Lesaffre, dropped at the end because its size was unverified.

## Breakdown
- **Size band:**
  - 5000+: 36
  - 1000-4999: 30
  - 200-999: 28
  - <200: 5
  - unknown: 12
- **Polish headcount:** 66 records have one. 18 of those figures are dated before 2023 and 13 are undated (job-board profiles), and all of them are flagged `approx` or explained in `notes`.
- **No Polish headcount (45 records):** 33 are sized from a global figure (`size_basis: global`). The 12 with no figure at all were kept only as plainly large employers, and `notes` explains why for each one (for example, hypermarket and pharmacy chains, five-plant manufacturers, or a global headcount that was not found).
- **The five <200 records** are law offices whose stated figure counts lawyers only (150-170). Total staff is likely higher.

## Overlaps with other staging files (checked 2026-10-15 ~17:00)
- **Removed:** 17 of my records already existed in `expansion-awards.jsonl`. These were Stryker, Ferrero, DLA Piper, Lear, Rawlplug, Kronospan, Kirchhoff, Arvato, DHL Express, Volvo Group, Circle K, Lagardère Travel Retail, Mars, Biogen, Colas, Amazon and InPost. My versions held a few facts their records may lack, which could be merged in:
  - Lear: 9,000 in Poland (aplikuj.pl Tychy profile, undated), Invest in Wroclaw.
  - Volvo Group: 4,000 (volvogroup.com Poland page), ABSL.
  - DHL Express: more than 1,040 employees in February 2025 (tvp.info article 85081377), AmCham.
  - Kronospan: more than 4,000 (Kronospan press release PDF, 12 Dec 2024), KSSE.
  - Kirchhoff: about 1,700 (aplikuj.pl), KSSE.
  - Arvato: 3,500 in 2017 (forsal.pl), ABSL.
  - Amazon: 19,000 (aboutamazon.pl, Oct 2026).
  - DLA Piper: 130 lawyers (careers.dlapiper.com).
- **Still overlapping with `expansion-tech-media.jsonl`, researched in parallel:** 13 records. These are Sollers Consulting, HPE, McKinsey, CMS, SK&S, Baker McKenzie, Dentons, DZP, RZM, Crido, Wardyński, Aon and UPS GBS. They are left in for the coordinator to dedupe, and some ids differ (for example, `dentons-warsaw` vs `dentons-poland`).

## What could not be verified
- **Blocked websites:** 34 official websites answer 403 (28) or drop the connection (6, recorded as status 0) for plain curl, mostly behind Akamai or Cloudflare. The real status is recorded. Their pages were read with a fetch tool or third-party pages where noted.
- **Email domains:** the `domain` value is usually the group's email domain and was assumed rather than confirmed for Polish staff in many cases. Records that combine several Polish companies (RTX, Adient, Marelli, Vinci Energies, BASF) say so in `relationship_note`.
- **Locations:** some locations come from search summaries and were not re-checked. Each record's `notes` says so.
- **Web searches:** the web-search budget ran out near the end. Remaining candidates with a likely large Polish presence were not researched. From AmCham/ABSL and the KSSE list these include Boston Scientific, Haleon, Zimmer Biomet, BMS, Societe Generale, NatWest, Nexteer, OPmobility, Nemak, Hirschvogel, Henkel and Linde. A follow-up pass could cover them.
