# Expansion from award lists and WSE indices (agent:expansion-awards, 2026-10-15)

Output: `expansion-awards.jsonl` has 150 records. All 150 pass the Zod schema in `src/lib/research/company-record.ts`, and every id is unique. No record's domain or id overlaps the known-domain list, the universe or the other staging files. Records hold organisational facts only, with no personal names or contacts. Records are sorted by Polish headcount, then group headcount, then unknown size.

## Sources used

| List | URL | Records citing it |
|---|---|---|
| Forbes Polska / Statista "Najlepsi Pracodawcy w Polsce 2026" (350 employers; the longlist covered companies with **250+ employees in Poland**) | https://rankings.statista.com/en/employers/rankings/best-employers-poland-2026/ | 59 |
| Forbes Polska / Statista "Najlepsi Pracodawcy w Polsce 2025" (300 employers, same 250+ rule) | https://rankings.statista.com/en/employers/rankings/best-employers-poland-2025/ | 23 |
| Great Place to Work Polska, "Najlepsze Miejsca Pracy Polska" 2024–2026, large and medium categories | https://www.greatplacetowork.pl/najlepsze-miejsca-pracy-3/najlepsze-miejsca-pracy-polska/2026 (also /2025, /2024) | 41 |
| Top Employers Institute, certified "Top Employers Poland" (74 companies; WordPress API of the PL site) | https://www.top-employers.com/pl/ (profiles under /pl/employer/…) | 12 |
| WSE mWIG40 portfolio (GPW Benchmark) | https://gpwbenchmark.pl/ajaxindex.php?action=GPWIndexes&start=ajaxPortfolio&format=html&lang=PL&isin=PL9999999912 | 12 |
| WSE sWIG80 portfolio (GPW Benchmark) | https://gpwbenchmark.pl/ajaxindex.php?action=GPWIndexes&start=ajaxPortfolio&format=html&lang=PL&isin=PL9999999979 | 24 |

I also checked WIG20. All 20 constituents are already known.

GPTW size categories come from the GPTW 2026 announcement: medium is fewer than 500 people, large is 500 or more, small is fewer than 100. So "medium" means 100–499 people in Poland. The 2024 and 2025 lists use the same category names, but their thresholds were not re-checked.

Award and index membership goes into `priority_signals` and `sources`. Index membership is recorded only as a source (`existence`), not as a training signal. For the 26 WSE-only records, `priority_signals` is therefore `[]`.

## Coverage

- Sectors: manufacturing/industrial 50, retail/consumer 28, pharma/healthcare 16, logistics 13, technology 12, business services 10, other (developers, tour operators, cinemas) 10, financial 5, professional services 3, telecom/media 2, energy 1.
- Headcount: Polish figure 37, group/global figure only 33, none found 80. Eight figures come from Wikipedia (pl) infoboxes and are flagged in `notes`; Unibep's is from 2018 and likely outdated.
- `polish_presence.evidence_url`: first-party Polish pages for most records. 28 use a GPTW or Top Employers profile of the Polish entity, because no first-party Polish page was reachable. 2 use Wikipedia (Inter Cars, Komputronik), because their sites block automated requests.
- Website checks use the exact curl command from the brief. 147 return 200. Three do not:
  - Barlinek returns 403 to plain curl and 200 to a browser user agent.
  - Schindler Polska returns 406 to plain curl and 200 to a browser user agent.
  - Inter Cars returns 403 to every request.

## Scope change applied

After the owner's message, consulting and law firms are in scope. Wavestone (GPTW 2025/2026) and DLA Piper (GPTW 2024) were added. McKinsey (Forbes 2026) was not added, because mckinsey.com/pl failed the HTTP check. Tech companies taken from the award lists stay in the file (SAP, Box, NVIDIA, j-labs, Intellias, ITDS, Univio, SoftwareMill, Qualtrics, Ensono, NTT DATA BS, Verisk), as do Publicis Groupe Poland and WSiP. Their `notes` say they may overlap with the tech/media researcher's list.

## Not verified or uncertain

- **Size unknown, kept on list evidence only.** The Forbes/Statista entries rest on the 250+ longlist rule. Some Top Employers records also have no figure, and 100+ is assumed likely but unverified: La Lorraine, Schindler, Endress+Hauser, Mleczarnia Turek, Toyota Bank, NTT DATA BS. The same applies to several WSE companies (Develia, Murapol, Echo, Mennica, VRG, Elektrotim, Unimot, TOYA, Voxel, Lubawa). Each record says so in `notes`.
- **Parents, legal names and HQ countries from general knowledge.** Some are not confirmed on a page (e.g. SERIS, Warbud/VINCI, Porsche Holding, MESKO/PGZ, Cinema City). Each is marked in `notes`.
- **Assumed email domains.** Examples: gls-poland.com, b-f.com, pandora.net, egis.pl, pcc.eu, tarczynski.pl, bridgestone.eu, volvo.com, inpost.pl. Each is marked in `notes`.
- **DHL:** three records (Parcel, Express, Global Forwarding) share `dhl.com`. They are separate Polish employers with separate awards; see `relationship_note`.
- **Forbes entries without a clear entity.** Some Forbes entries are just brand names ("DHL", "Volvo Group", "Bridgestone"). They were mapped to the most likely Polish entity, as explained in `notes`.

## Candidates seen on the lists but not added

- **No reachable or verifiable website** (403, TLS errors, timeouts): Nestlé, BP, ABB, 3M, HPE, Caterpillar, Air Products, Avon, x-kom, Super-Pharm, TK Maxx, Sephora, Apart, Wojas, Agata, Marcopol, Phoenix Contact, Impel, ID Logistics, Totalizator Sportowy, Bruk-Bet, Budmat, Grupa PSB, Pratt & Whitney Rzeszów, Unilever, Primark, Beko Europe Poland, Holcim Polska, GEA, Enter Air, Comp, Answear, Synektik, Mo-BRUK, Coca-Cola HBC (challenge page), MetLife, Revvity, AbbVie, Zendesk, Hilton, Marriott, McKinsey, Kik, Multikino, PepsiCo, 4F (OTCF).
- **No first-party or award page proving the Polish operation:** Dell, Jabil, Autoliv, Marelli, CNH, Demant, Dräxlmaier, Inditex, H&M, UPS, FedEx, Stadler, Thule, Getinge, Eurofins, Honeywell, Cooper Standard, OPmobility, Winkelmann, Bader, Remondis, ADM.
- **Ambiguous entity or size:** Aviva (sold to Allianz in 2021, yet still listed by GPTW), John Deere Polska, PUMA Polska, HiPP Polska, WS Audiology, IG Group, Capital.com, EDP Renewables Polska, UniCredit Poland, CHEP, Vossloh, Inetum, smaller WSE names (Vercom, Votum, Onde, Bumech, Ferro and the small-cap biotech and gaming companies).
- **Wrong site found under the expected domain:**
  - adampol.pl is a different company.
  - alstal.pl is AL-STAL, not ALSTAL Grupa Budowlana.
  - aviopolska.pl is a blog, not Avio Polska.
  - instal.com.pl looks like Instal-Lublin, not Instal Kraków.
- **Excluded:** universities, public hospitals, municipal transport companies, the Polish Red Cross, a school operator (TEB Edukacja) and Gi Group (Polish site unreachable). Edge One Solutions was left out because it is part of Euvic, which is already known. DB Schenker Technology Center was left out because it is now part of DSV, which is already known.

## Not done

- Kincentric/Aon Best Employers Polska, "Lider HR" and "Inwestor w Kapitał Ludzki" were not checked.
- The pl.wikipedia API rate-limited this IP (429), so only a few direct Wikipedia page reads were possible.
