# Financial services slice: research log

- Researcher: `agent:financial`, 2026-10-15
- Output: `financial.jsonl`, 65 records, sector `financial_services`
- Validation: every line parses as JSON, ids are unique, and the fields were checked against the rules in `src/lib/research/company-record.ts` (enums, URL fields, domain regex, positive integer headcounts).
- Website checks: `curl -sSL -m 20` with the research user agent on 2026-10-15. Four sites returned **403** to automated requests: bosbank.pl, bgk.pl, revolut.com/pl-PL and pfr.pl. Their Polish-presence evidence comes from Wikipedia instead.
- Every URL in the file was requested in this session, apart from a few `group_website` values copied from Wikidata (P856). All recorded URLs were requested again at the end. All returned 200 except revolut.com (403). millenniumbcp.pt did not respond, so it was removed.

## Coverage

| Group | Records |
|---|---|
| Banks (universal, corporate, consumer, cooperative-group associating banks, BGK, NBP, Revolut, Kasa Stefczyka credit union) | 21 |
| Insurers (PZU, Warta, ERGO Hestia, Allianz, Generali, UNIQA, Compensa, NN, InterRisk, LINK4, TU Europa, SIGNAL IDUNA, KUKE) | 13 |
| Leasing (PKO Leasing, EFL, Pekao Leasing, Arval, BNP Paribas Leasing Solutions, Ayvens, VW Financial Services) | 7 |
| Payments, fintech and brokerage (PayU, Autopay, Przelewy24/PayPro, PeP, eService, Fiserv Polska, BLIK/PSP, Tpay, XTB, Euronet, Worldline) | 11 |
| Consumer finance and debt (Provident, KRUK, BEST, Intrum, Cofidis, B2 Impact, EOS, Hoist) | 8 |
| Market infrastructure and development finance (GPW, KDPW, KIR, BIK, PFR) | 5 |

### Headcount

- **28** records have a Polish headcount (`size_basis: poland`).
- **21** have only a global or group figure (`global`).
- **16** have neither (`unavailable`).

Most Polish figures are rounded statements from first-party careers pages ("ponad X pracowników"). Those carry `approx: true`, and their `as_of` is null where the page gives no date. Figures for bank groups are FTEs or group totals, as stated in each record's `notes`.

### Training signals

44 records have at least one signal with a URL:

- **Top Employer:** PKO BP, Erste, Millennium, Santander Consumer, NN, Worldline and Provident.
- **Great Place to Work:** Erste, Compensa, InterRisk, XTB and Worldline.
- **Named leadership programmes:** ERGO Hestia, Citi Handlowy, Alior and B2 Impact.

## List sources used for discovery

- Wikipedia (en), [List of banks in Poland](https://en.wikipedia.org/wiki/List_of_banks_in_Poland). It is based on the KNF register as of 2026-03 and covers systemically important banks, joint-stock banks, cooperative groups, credit unions and foreign branches.
- Wikipedia (pl), category pages:
  - [Polskie przedsiębiorstwa ubezpieczeniowe](https://pl.wikipedia.org/wiki/Kategoria:Polskie_przedsi%C4%99biorstwa_ubezpieczeniowe)
  - [Polskie przedsiębiorstwa finansowe](https://pl.wikipedia.org/wiki/Kategoria:Polskie_przedsi%C4%99biorstwa_finansowe)
  - [Krajowe Instytucje Płatnicze](https://pl.wikipedia.org/wiki/Kategoria:Krajowe_Instytucje_P%C5%82atnicze)
  - [Leasing](https://pl.wikipedia.org/wiki/Kategoria:Leasing)
  - [Banki w Warszawie](https://pl.wikipedia.org/wiki/Kategoria:Banki_w_Warszawie)
- Wikidata (P1128 employees, P856 website), read through `Special:EntityData`. Wikipedia infoboxes (pl and en) were used for headcount and parent groups.
- [Statista/Forbes "Poland's Best Employers 2026"](https://rankings.statista.com/en/employers/rankings/best-employers-poland-2026/). The table loads with JavaScript and could not be read, so it was only used through company pages that cite it (Warta).
- Top Employers Polska: no public list could be fetched from top-employers.com. Certifications were taken from the companies' own pages.
- Not used: the KNF register search, the ZBP and PIU member lists, GPW index constituents and Lista 500. The shared web-search budget ran out partway through. Their content was covered indirectly by the KNF-based Wikipedia list and the Wikipedia categories.

## Candidates rejected and why

| Candidate | Reason |
|---|---|
| MetLife Polska | Acquired by NN Group in 2022 (search results). metlife.pl now redirects to a MetLife careers page, i.e. its Warsaw service/technology centre, which belongs to business_services. |
| Wiener TU (VIG) | Wikipedia (pl) says it operated 1990–2024. Not a current employer. |
| Kredyt Inkaso | Merged into BEST S.A. (Kredyt Inkaso investor-relations site). Covered by the `best` record. |
| Deutsche Bank Polska, Toyota Bank Polska, Plus Bank, DNB Bank Polska, UniCredit/Aion, Bank Nowy, Inbank, TF Bank, Ikano | Likely below 200 staff or no verifiable size. plusbank.pl returned HTTP 520. |
| Foreign credit-institution branches (Goldman Sachs, JP Morgan, HSBC, Citibank Europe, Nordea, Danske, SEB, UBS and others) | Out of scope: operations or shared-service centres belong to business_services, or the branches are small. |
| KNF, Bankowy Fundusz Gwarancyjny | Regulator and resolution authority: public administration rather than financial services. |
| mLeasing, Erste Leasing, ING Lease, Millennium Leasing, Alior Leasing | Bank leasing subsidiaries that would duplicate the parent brand. PKO Leasing and Pekao Leasing were kept as larger, separately branded companies. |
| Saltus, Unum, Pocztowe TU, TUZ | Small; no size or L&D evidence found. (SIGNAL IDUNA Polska was kept, with unknown size.) |
| Currency One, PayPo, Ramp Network, Zondacrypto, Twisto, Smartney | Size unverified, likely below 200, or HQ outside Poland (Zondacrypto: Tallinn). |
| Large single cooperative banks (BS Brodnica, Krakowski BS and others) | No headcount found. Covered at group level by Bank BPS and SGB-Bank. |
| TFIs and asset managers (PKO TFI, Pekao TFI, Goldman Sachs TFI, Quercus and others) | Either part of a bank or insurance group already listed, or below 200 staff. No standalone asset manager met the bar. |
| Insurance brokers (Aon, Marsh, Mentor) | Not researched. Aon's Kraków centre would fall under business_services. |
| Link4 | Kept, despite being a PZU subsidiary: it is a distinct brand with its own management board and careers site. |

## Gaps and uncertainties

- **No Polish headcount found** for: Credit Agricole, Santander Consumer Bank, BOŚ, SGB-Bank, Nest Bank, Revolut, Generali, UNIQA, Compensa, NN, InterRisk, LINK4, TU Europa, SIGNAL IDUNA, KUKE, PKO Leasing, Pekao Leasing, Arval, BNP Paribas Leasing Solutions, Ayvens, VW Financial Services, Fiserv Polska, eService, BLIK, Tpay, XTB (group figure only), Euronet, Worldline, Provident, KRUK (group FTE only), Intrum, Cofidis, Hoist, KDPW, KIR, BIK and PFR. For these, the size band falls back to the global group, which can overstate the Polish entity (for example Cofidis, Ayvens, Hoist).
- **Ownership changes:**
  - Santander Bank Polska is now **Erste Bank Polska**, with Erste Group holding about 49% since January 2026. santander.pl redirects to erste.pl. The staff email domain is not verified.
  - **Citi Handlowy** is demerging its retail business (1,520 staff at end-2025) to **VeloBank**.
  - **PayU Poland** ownership after Rapyd's PayU GPO deal is reported (by a single Polish outlet, via search) to have stayed with Prosus/Naspers. Not confirmed first-hand.
- **Old or undated figures:**
  - Undated: ERGO Hestia (3,000, Wikidata), Bank Pocztowy (1,100) and BEST (~1,000, may predate the Kredyt Inkaso merger).
  - From 2020: BGK (1,859 FTE) and NBP (3,355).
  - Parent-group figures for UNIQA (2019), VIG (2018) and Talanx (2020) are also old.
- **Group HQ countries not confirmed on a fetched page:** B2 Impact (Norway) and EOS (Germany) are set from general knowledge and flagged in `notes`.
- **Legal names not verified** for several foreign-owned entities (Generali, UNIQA, NN, Arval, Ayvens, VWFS, Euronet, Worldline, Intrum, Cofidis, EOS, TU Europa). These records use the brand-style name described in `notes`.
- **Worldline Polska:** check whether part of its Polish staff is a group service/technology centre, which would belong to business_services.
- **Email domains:** where staff probably use a group domain (Citi Handlowy, Fiserv Polska, PayU, Erste), `domain` holds the Polish website domain and `notes` flags it.
