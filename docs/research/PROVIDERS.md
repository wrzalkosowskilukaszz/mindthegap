# Contact-data, verification and discovery providers: evidence-based comparison

**For:** Mind The Gap private outreach app (L&D / HR / people-development decision makers at large companies operating in Poland).
**Prepared:** 2026-10-15. **All sources below were accessed on 2026-10-15** unless a row in §12 says otherwise.
**Status:** research only. No accounts were created, nothing was bought, no forms were submitted, no API keys were used except keys that the vendor publishes as public test or demo keys (see §8).

## How to read this document

Every claim carries one of three evidence labels and a source ID that resolves in §12 (Sources, each with URL and access date):

| Label | Meaning |
|---|---|
| **[O]** | Stated in the provider's own official documentation, pricing page, terms or privacy policy. |
| **[3P]** | Third-party claim (blogs, review sites, competitor comparisons). Treat as unverified. Some 3P items were seen only in a search-engine result summary, not opened; this is marked "(search summary)". |
| **[T]** | Something we actually tested on 2026-10-15 (see §8 for the exact requests and results). |

"Unclear" means the official pages we could read did not settle the point. Several official pricing pages are rendered by JavaScript and could not be read with plain HTTP fetches; this is stated per provider. **The web-search budget for this session ran out before the end of the research**, so a few points that would normally get one more cross-check are marked "unclear" rather than resolved.

---

## 1. Summary

- **Primary contact-data provider: Hunter.io (Starter plan).** It is the only evaluated provider whose API returns, for every email, the public web pages where it was found (URL, first-seen date, last-seen date, still-on-page flag) [O HU2], has a dedicated endpoint that never returns pattern-generated addresses [O HU2], filters by department `hr`, seniority, job title, decision-maker flag and person location (country code) [O HU2], and includes the API on every plan including Free [O HU1]. That makes provenance storage and an honest GDPR Art. 14 notice ("where we got your address") straightforward. Its coverage of Polish HR/L&D staff is **unknown**: no provider publishes Poland-specific coverage figures that we could find, so the owner should run a small pilot on the free plan first.
- **Verification:** Hunter's built-in verifier (0.5 credit per verification) at first [O HU1]. Optional second opinion: MillionVerifier (credits never expire; 10,000 credits for $39 in the site's own pricing table) [O MV1].
- **Discovery search API: Tavily** (free plan 1,000 credits/month; basic search 1 credit) [O TA1, TA2]. Its terms do not forbid storing outputs [O TA5]. **Brave Search API** is a good index but its standard terms forbid storing or databasing search results beyond transient use [O BR2], which conflicts with the app's provenance requirement unless the owner obtains a plan "that explicitly grants storage rights" [O BR1]. **Google's Custom Search JSON API is closed to new customers** [O GO1].
- **Free structured sources:** KRS open API (no key; company facts, website, board composition, **but board members' names and PESEL are masked in the API output** [T]); GUS REGON BIR (free key by email request; company-level data including e-mail/website/phone fields) [O GUS1, GUS2]; Wikidata SPARQL (CC0; useful for the company list, not for HR contacts) [O WD2, T].
- **Estimated cost at ~300 domain searches + ~500 verifications/month:** about **$49/month** (Hunter Starter billed monthly; $34/month if billed yearly at $408) + **$0** for Tavily within the free tier + optional **$39 one-off** for MillionVerifier. Details and assumptions in §9.
- **Legal caveat (not legal advice):** Poland's *Prawo komunikacji elektronicznej* art. 398 prohibits sending commercial information by e-mail to a subscriber or end user without prior consent [O-statute reproduction L2], and commentary states this covers legal persons and B2B contacts [3P L3]. No provider choice removes that constraint. See §7.

---

## 2. Requirements recap (what the providers were judged against)

1. Contacts of L&D / HR / people-development decision makers at large companies operating in Poland.
2. Server-side API usable from replaceable adapters, daily discovery job with spending limits.
3. Provenance: store source URLs / provider IDs and the **original** verification result.
4. No fabricated or misrepresented data; distinguish published vs pattern-predicted emails.
5. Respect provider terms and GDPR / Polish law. Small budget, one-person business.

---

## 3. Contact-data providers

### 3.1 Comparison matrix

| Provider | API on which plans | Cheapest plan with API (official) | Role filters in API (HR / L&D) | Returns source URLs | Distinguishes found vs pattern-predicted | Verification statuses exposed | Storage / post-cancellation (terms) |
|---|---|---|---|---|---|---|---|
| **Hunter.io** | All plans incl. Free (API row checked for Free, Starter, Growth, Scale, Enterprise) [O HU1] | Free: 50 credits/mo; Starter $49/mo or $408/yr, 2,000 credits/mo [O HU1] | `department=hr` (+ executive, management, education…), `seniority` junior/senior/executive, `job_titles`, `decision_maker`, person `location` by ISO country [O HU2] | **Yes**: `sources[]` with `uri`, `extracted_on`, `last_seen_on`, `still_on_page` (max 20) [O HU2] | **Yes**: `/v2/email-finder/found` returns only web-found addresses, `source_type: "found"`; generated addresses "are never returned" there [O HU2] | Domain Search/Finder: `valid`, `accept_all`, `unknown` + date; Verifier: `valid`, `invalid`, `accept_all`, `webmail`, `disposable`, `unknown` [O HU2] | Terms silent on storing in own DB; no post-termination deletion duty found; customer is "independent Controller" [O HU3] |
| **Apollo.io** | **Conflicting**: pricing FAQ says "API access is available on Custom plans" [O AP1]; API docs list rate limits for Free/Basic/Professional/Organization and say free accounts need a work-email registration [O AP2, AP5] | Unclear (prices not in fetched HTML) [O AP1]; 3P: Basic ~$49, Professional ~$79 per user/mo annual [3P AP8, search summary] | `person_titles[]`, `person_seniorities[]` (owner…intern), `person_locations[]`, `organization_locations[]`; **no department filter documented** in the search endpoint [O AP2, T: grep found 0 mentions] | No (`email_source` field exists but is `null` in the example and undocumented) [O AP3] | Unclear | `verified`, `unverified`, `likely to engage`, `unavailable` [O AP2] | Perpetual licence to business contact info incorporated into your systems; may retain after termination; internal business use only [O AP6] |
| **Lusha** | "Every user gets their own key by default, on every plan including Free" [O LU2] | Free: 40 credits/mo; Starter $49.90/mo or $449.10/yr, 400 credits/mo [O LU1] | Prospecting filters exist; specific HR/department values not confirmed on pages read [O LU3] | Not documented | Unclear | Not documented on pages read | Customer "may continue to use the Data after the termination", except termination for breach (then delete) [O LU4 §2.4, §16.3.2] |
| **Cognism** | "MCP & API access" listed on Standard (and Pro includes Standard) [O CO1] | Quote only; 5 seats included [O CO1] | Search API exists; filters not readable (help pages 403) [O CO3 search summary] | Not documented | Unclear | Not documented | Not reviewed (terms not fetched) |
| **Kaspr** (Cognism) | Starter: "Limited API access", Business: "API access", both "available only upon request" [O KA1] | Starter €45 or €59 per user/mo (page does not label which is monthly vs annual) [O KA1] | None: API input is a **LinkedIn profile URL** [O KA2] | No | Unclear | Not documented | Not reviewed |
| **Snov.io** | Starter and Pro: "API & Webhooks"; Trial excludes API [O SN1] | Starter $39/mo, 1,000 credits [O SN1] | Database search: `departments` incl. `human_resources`; `management_levels` c_level/vp_level/director_level/manager_level/staff; prospect and company `locations` (country) [O SN2] | Partly: `source_page` on domain-search prospects; `source` on enrich-by-email [O SN2] | Partly: `unknown` reasons incl. `catchall` [O SN2] | `valid`, `not_valid` (verifier), `unknown` (+ reason) [O SN2] | Terms silent on exporting/storing; customer indemnifies Snov.io for failing to notify data subjects [O SN3] |
| **RocketReach** | Free accounts: no API; "email api@rocketreach.co to set up an API plan" [O RR4 search summary]; 3P: API only on top tier "Ultimate" [3P RR5 search summary] | Official pricing page not readable (JS) [O RR1] | Person search exists; filters not reviewed | Not documented | Unclear; email credits charged for "verified (A or A-) emails" [O RR3] | Grades A/A- mentioned [O RR3] | Not reviewed |
| **Dropcontact** | Starter and Growth: "API & MCP access" [O DC1] | Starter headline €79/mo; lowest Starter quota shown is 500 credits/mo, but the page does not explicitly tie the price to that quota [O DC1] | **None**: enriches contacts you submit (name + company / LinkedIn / email); no role search [O DC2] | No | Algorithmic finder (no contact database claimed) [O DC1]; returns qualification `nominative@pro`, `catch_all@pro`, etc. [O DC2] | Local part: `nominative`, `catch_all`, `generic`, `random`, `invalid`; domain: `pro`, `perso`, `invalid` [O DC2] | Reuse for resale prohibited; no explicit storage grant; French law [O DC3] |
| **Prospeo** | Help centre: Free "Limited API access", Starter/Growth/Pro "API access" [O PR2]; API docs index: "Free API access for all users" [O PR3]; site pricing bundle marks "Public API" not included on Free [O PR1] (conflict) | Starter; price only in client-rendered page: site JS fallback shows $49/mo monthly, $37/mo billed yearly [O PR1]; 2,000 credits/user/mo [O PR2]; 3P agrees on $49 [3P PR9 search summary] | `person_department` with explicit **"Learning & Development"**, "Talent Management", "People Operations", "HR Business Partner"…; `person_seniority`; `person_job_title`; person and company location [O PR5, PR7] | No | Unclear (only `VERIFIED` documented; `verification_method` e.g. `BOUNCEBAN`) [O PR4] | `VERIFIED` (others not documented) [O PR4] | **Unclear**: terms/privacy pages are client-rendered and could not be read [O PR1 note] |
| **ZoomInfo** (brief) | API offered as a product [O ZI1] | No public prices; sales-led [O ZI1] | Not reviewed | Not reviewed | Not reviewed | Not reviewed | Not reviewed |
| **FullEnrich** (EU-market waterfall, brief) | Pro lists "API & no-code integration" [O FE1] | Pro ≈ 1,000 credits at $0.055/credit (price text garbled; inferred) [O FE1] | Search API listed; filters not reviewed [O FE1] | No; aggregates "25+ sources" without storing contacts [O FE1] | No | SMTP + catch-all checks, confidence score [O FE1] | Not reviewed |

### 3.2 Credit consumption per operation

| Provider | Search (find people) | Reveal / find email | Verify | Notes |
|---|---|---|---|---|
| Hunter | Discover (companies) free [O HU2]; Domain Search: **1 credit per email found**; no emails, no credit [O HU1] | Email Finder: 1 credit per email found; free if none [O HU1, HU2] | 0.5 credit; free if result is `unknown`; disposables skipped [O HU1] | Default `limit` is 10 emails per Domain Search call, max 100 [O HU2]: always set `limit` to cap spend. Repeated identical searches/verifications count once per calendar month / billing period [O HU1]. Account endpoint and Email Insight are free [O HU2]. |
| Apollo | People API Search: 0 credits, returns no emails/phones [O AP2] | People Enrichment: 1 credit for email/demographics, +8 if a mobile is returned; 0 if nothing found [O AP3] | n/a | Credits do not roll over [O AP1]. |
| Lusha | Not stated for prospecting [O LU2] | Email 1, phone 5, company 1; **minimum 1 credit per request even if no data** [O LU2] | n/a | Monthly credits roll over up to 2× plan limit while subscribed [O LU1]. |
| Cognism | Search and Enrich: no credits; Redeem contact: 1 credit [O CO1; CO3 search summary] | | n/a | Re-charge only on job change [O CO1]. |
| Kaspr | n/a (LinkedIn URL in) | Credits per data type + 1 export credit per successful call [O KA2] | n/a | |
| Snov.io | Prospect search free (1 page on free accounts); company search 1 credit [O SN2] | 1 credit per prospect email; Email Finder 1 credit per `valid`/`unknown` result [O SN2] | 1 credit per verification [O SN1] | 60 requests/minute [O SN2]. |
| RocketReach | Person search 1 credit/page (≤100 results) [O RR3] | Professional email 2 credits, personal 3, phone 6 [O RR3] | Verify: refunded on `unknown` [O RR2] | "Universal credits". |
| Dropcontact | n/a | 1 credit only when a verified email is returned [O DC2] | Verification-only: 1 credit [O DC2] | Async batches ≤250 [O DC2]. |
| Prospeo | Search Person: 1 credit per request returning ≥1 person (25 per page); same page free again within 30 days [O PR5] | Enrich: 1 credit per email found, 10 per mobile; not charged if no result; same record free within 90 days [O PR4] | No standalone verify endpoint in the API index [O PR3] | Credits do not roll over [O PR2]. |

### 3.3 Rate limits (official)

| Provider | Limits |
|---|---|
| Hunter | Domain Search & Email Finder 15 req/s, 500/min; Verifier 10 req/s, 300/min; Discover 5 req/s, 50/min [O HU2]. |
| Apollo | Free 50/min, 200/h, 600/day; Basic/Professional 200/min, 400/h, 2,000/day (search endpoints 200/min, 6,000/h, 50,000/day on paid) [O AP5]. |
| Lusha | Free & Starter 40/min, 100/day; Pro 50/min, 150/h, 1,500/day; Premium 300/min, 1,800/h, 18,000/day [O LU2]. |
| Snov.io | 60 requests/minute [O SN2]. |
| Prospeo | Starter: enrich 5/s, 300/min, 2,000/day; search 1/s, 30/min, 1,000/day [O PR6]. |
| Dropcontact | 60 requests/second; batch ≤250 contacts [O DC2]. |
| RocketReach | Numbers not on pages read; 429 on heavy use [O RR2]. |

### 3.4 Provider notes

#### Hunter.io (recommended primary)
- **Data collection [O]:** "Hunter crawls public web pages to collect data related to professional profiles"; addresses can also be generated "through pattern analysis" when not published [HU5]. 150M professional emails indexed, 30M pages crawled per day [HU6].
- **Freshness [O]:** retention conflict between two official pages: "After six months, we remove contact or company information that no longer has public sources" [HU6] vs. profiles removed "within 3 months if no longer on source pages" [HU5]. Verifier may return a verification "made up to one month ago" with its date [HU2].
- **GDPR posture [O]:** main servers on Google Cloud in Belgium; most sub-processors in the EU or USA with SCCs [HU4]. Legal basis for profile data: legitimate interest [HU5]. Opt-out through the Claim feature (hunter.io/claim) or privacy@hunter.io [HU5]. Users "remain an independent Controller" and must set purpose and legal basis [HU3, HU4]. Whether Hunter itself sends Art. 14 notices is **not stated** [HU5].
- **Terms [O]:** contracting entity Hunter Web Services, Inc. (Delaware law); prohibits building "a similar or competitive service"; API abuse may lead to suspension; no clause requiring deletion of obtained data after cancellation was found [HU3]. Storage in our own database is therefore not prohibited by the text we read, but also not expressly granted: **unclear**, low risk for internal use.
- **Poland coverage:** no official statement about Poland or Europe [O HU6]. Department/location filters make a Poland-located HR search possible; actual hit rate untested.
- **Integration:** plain REST, key via `X-API-KEY` header, `Authorization: Bearer` or `api_key` query; 401 on missing/invalid key [O HU2, T].

#### Apollo.io
- Large B2B database with a 0-credit people search and a credit-consuming enrichment step [O AP2, AP3]. Personal emails are not revealed for people in "a GDPR-compliant region" [O AP3].
- **Data sources [O AP7]:** public websites and directories, third-party providers, and a "Contributor Database" that customers' data (including authorised Google Workspace / Microsoft 365 email and calendar access) may "grow, enrich, and verify". Apollo has a separate Article 14 Processing Notice and an opt-out page [O AP7].
- **Why not primary:** API plan access is contradictory on official pages (Custom plans vs per-plan rate limits) [O AP1, AP5]; no department filter documented for the API search; no source URLs; contributor-network sourcing makes it hard to tell a recipient where their address came from (Art. 14(2)(f)).

#### Lusha
- API on every plan including Free [O LU2], but Free/Starter are limited to 100 requests/day [O LU2] and every request costs at least 1 credit even with no data [O LU2].
- Data partly from its "Community": "email headers and signatures" and calendar surface data of members [O LU5]; Lusha says professionals receive a notification "where required by law" [O LU5].
- Terms: internal business use; data may be used after termination unless terminated for breach; ban on feeding data to external AI systems for training [O LU4].
- **Not recommended initially:** no source URLs, small credit allowance per dollar for emails (Starter 400 credits/month at $49.90) [O LU1].

#### Cognism and Kaspr
- Cognism: quote-only pricing, 5 seats included, API on Standard [O CO1]; legitimate interest, notifies business contacts "within GDPR timeframes", screens phone data against DNC lists, generally keeps data in the EEA [O CO2]. Poland/CEE coverage claims conflict between third parties ("reasonably strong" vs "Limited") [3P CO4, search summary]. Not budget-compatible for a one-person business.
- Kaspr (acquired by Cognism, announced 27 April 2022 [O CO5, search summary]): API needs a LinkedIn profile URL as input [O KA2]; data collected "from social networks such as LinkedIn" and directories, retained 5 years [O KA3]. The CNIL fined KASPR €240,000 (decision 5 December 2024, published 19 December 2024) for collecting LinkedIn contact details of users who had restricted their visibility, excessive retention, failure to inform people and failure to answer access requests [CNIL page KA4 returned HTTP 503 to our fetcher; facts from search summaries of the CNIL page and of KA4b/KA4c]; the injunction was closed by a CNIL deliberation of 4 March 2026 [KA5, search summary]. **Not recommended.**

#### Snov.io
- API from Starter ($39/mo, 1,000 credits) [O SN1]; database search filters include `human_resources` department, management levels and country locations [O SN2]; domain-search prospects carry `source_page` [O SN2]. OAuth client-credentials token (1 h) and asynchronous start/result endpoints [O SN2]; 60 requests/minute [O SN2]. Snovio Inc., Delaware law [O SN3].
- A reasonable alternative secondary source if Hunter's Polish HR coverage is thin.

#### RocketReach
- Clear per-operation credit model [O RR3], but official pricing page not readable and third parties say API is only on the top tier [3P RR5]. Not recommended for this budget.

#### Dropcontact
- French company (SAS, Aulnay-sous-Bois; French law) [O DC3]; "pay on success" [O DC1]; claims not to use contact databases [O DC1]. It **cannot find people by role**: you must already know the name [O DC2]. Its emails are found algorithmically (pattern + verification), so they are predicted-then-verified, not "published". Useful only as an EU-based enrichment/verification step later; €79/month is high for this need.

#### Prospeo
- Strongest role filter for this use case: department values include **"Learning & Development"**, "Talent Management", "People Operations", "HR Business Partner", "Recruiting & Talent Acquisition" [O PR7]; seniorities Founder/Owner … Intern [O PR7].
- Two-step flow: search (no emails returned) → enrich by `person_id` [O PR5, PR4].
- Data "comes from public web content, licensed partners, and customer contributions"; legitimate interest; opt-out with suppression list [O PR8]. **No source URLs** in API responses.
- **Blocker:** terms of service, privacy policy and trust centre are client-rendered and could not be read [O PR1 note]; the legal entity is not named on pages we could read [O PR8]. Do not adopt until the owner reads the terms in a browser.
- Good candidate **secondary** source for a pilot comparison against Hunter.

#### ZoomInfo (brief)
- Enterprise, sales-led pricing; no public prices; API sold as a product [O ZI1]. Not suitable for this budget.

#### Other EU / Polish options
- **FullEnrich** (waterfall over "25+ sources", says it stores no contacts) [O FE1]: opaque upstream sources make provenance and Art. 14 "source" information hard. Not recommended initially.
- **Polish registries** (KRS, REGON) give company facts, not HR contacts; see §6.
- **Rejestr.io** (Polish commercial KRS data service): not evaluated. Its pages returned a Cloudflare challenge (HTTP 403) to our fetcher [T]. Worth a manual look by the owner if full board-member names are needed, since the official KRS API masks them (§6).

---

## 4. Standalone email verification APIs

| Service | Pricing (official) | Free | Statuses | Notes |
|---|---|---|---|---|
| **Hunter Email Verifier** | 0.5 credit per verification inside Hunter plans [O HU1] | 50 credits/mo on Free [O HU1] | `valid`, `invalid`, `accept_all`, `webmail`, `disposable`, `unknown` (+ flags `smtp_check`, `accept_all`, `block`, `mx_records`, score, date) [O HU2] | Not charged for `unknown` [O HU1]. Returns `sources` for the address [O HU2]. |
| **MillionVerifier** | 10,000 credits $39; 25,000 $59; 50,000 $89; 100,000 $149 (pricing table in the site's own script) [O MV1]; "they never expire" [O MV1] | 100 credits on sign-up [O MV1] | `result`: `ok`, `catch_all`, `unknown`, `invalid`, `disposable`, `unverified`, `error` with `quality` good/risky/bad and `subresult` [O MV2, T] | Publishes demo keys that return fixed results, ideal for adapter tests [O MV2, T]. "Full refund on any email we can't verify with certainty" [O MV1]. |
| **ZeroBounce** | Pay-as-you-go "starts at $39 USD for validating 2,000 email addresses" [O ZB1] | Freemium 100 credits/month [O ZB1] | `valid` (sub: `alias_address`, `alternate`, `accept_all`…), `invalid`, `catch-all`, `spamtrap`, `abuse`, `do_not_mail` (sub: `role_based`, `disposable`, `toxic`, `global_suppression`…), `unknown` [O ZB2] | Not charged for `unknown` [O ZB1, ZB2]. Most detailed taxonomy. API host returned Cloudflare "error code: 1020" (HTTP 403) to our test client [T], so we could not even confirm the auth error. |
| **NeverBounce** | Official pricing page returned HTTP 403 to our fetcher [O NB1]. 3P: about $0.008/email pay-as-you-go [3P NB3, search summary] | Unclear | `valid`, `invalid`, `disposable`, `catchall`, `unknown` [O NB2] | Keyless call returns HTTP 200 with `"status":"auth_failure"` [T]. |

**Catch-all caveat:** for `accept_all` / `catch_all` domains no SMTP verifier can confirm a mailbox [O ZB2 "impossible to validate without sending a real email"]. Many large companies run catch-all mail servers, so expect a share of `accept_all` results; store them as such and never relabel them as valid.

---

## 5. Web-search APIs for discovering public pages

| Service | Price (official) | Free tier | Storage of results (terms) | Our assessment |
|---|---|---|---|---|
| **Tavily** | Basic search 1 credit, advanced 2 [O TA2]; Project $30/4,000 credits; pay-as-you-go $0.008/credit [O TA2] | Researcher: 1,000 credits/month, no card [O TA1] | No clause on storing outputs; licence "solely for Customer's internal business purposes"; data-mining ban with a carve-out for reasonable API use [O TA5] | **Recommended** for discovery. `country` boost, `include_domains`, `include_raw_content` [O TA3]. Dev keys 100 RPM; production keys need paid plan or PAYGO [O TA4]. AlphaAI Technologies Inc. (New York law) [O TA5]. |
| **Brave Search API** | Search $5 per 1,000 requests; $5 free credits/month; 50 QPS [O BR1] | $5 credit/month (≈1,000 queries); card required to confirm identity [O BR1] | Standard ToS: may not "store, cache, or create a database of Search Results, in whole or in part" except transient; delete results on termination [O BR2 §3(b)(i), §13(c)(ii)]. Storing requires "a plan that explicitly grants storage rights" [O BR1] | Good independent index, but conflicts with provenance storage unless the owner buys/negotiates storage rights. **Secondary.** |
| **Google Custom Search JSON API** | $5/1,000 after 100 free/day (existing customers) [O GO1] | n/a | n/a | "The Custom Search JSON API is closed to new customers"; existing customers must move by 1 January 2027 [O GO1]. **Not usable.** |
| **Serper** | Starter pack $50 for 50k queries ($1/1k), credits valid 6 months [O SE1] | 2,500 free queries [O SE1] | Terms do not address storing outputs; UK law [O SE2] | Returns Google results via a third party, not an official Google API; legal basis not evaluated. Not recommended. |
| **SerpAPI** | Starter $25/mo for 1,000 searches; Free 250/mo [O SA1] | 250 searches/month [O SA1] | Not reviewed | Same Google-results concern; "Legal Shield" listed as a plan feature [O SA1]. Not recommended. |
| **Exa** | Instant search $4/1k, fast/auto $7/1k (≤10 results) [O EX1] | $10 credits/month [O EX1] | Restricts copying/reproducing "any information contained on, or obtained from or through, the Services" except as permitted [O EX2 §4.2(a)] | Restrictive for storage. Not recommended. |

---

## 6. Free / public structured sources

| Source | Access | What it gives | Limits / caveats |
|---|---|---|---|
| **KRS open API** (`api-krs.ms.gov.pl`) | No key, no sign-up [T] | Current (`OdpisAktualny`) and full (`OdpisPelny`) extracts as JSON: legal name, legal form, identifiers, registered address, **company website** (`adresStronyInternetowej`), management board (`dzial2.reprezentacja.sklad` with function), supervisory board, proxies [T] | **Board and supervisory-board members' first names, surnames and PESEL are masked** (first letter + asterisks) in both extracts: 143/143 surname fields masked in a full extract we tested [T]. So the open API does **not** give board-member names. No e-mail field was present in the extract we tested [T]. Official documentation page returned no readable content [O KRS2]. Unknown KRS number → HTTP 404 [T]. |
| **GUS REGON BIR 1.2** | Free; production key by e-mail to regon_bir@stat.gov.pl with entity name, REGON, contact person, **IP addresses** of the calling systems and expected concurrent users [O GUS1]. SOAP 1.2 service [T]. Public test key for the test environment is in the official docs [O GUS2] | Company data by REGON, NIP or KRS [O GUS1]; legal-person report schema includes `praw_adresEmail`, `praw_adresStronyinternetowej`, `praw_numerTelefonu` [O GUS2] | 08:00–16:59: 6,000/h, 120/min, 3/s; evenings and nights higher [O GUS1]. The IP-address requirement fits a fixed-IP worker better than serverless functions. Test database is anonymised and not updated [O GUS2]. |
| **Wikidata SPARQL** | No key; descriptive `User-Agent` required, 60 s query timeout, 60 s processing per 60 s, 5 parallel queries per IP [O WD1] | Company list and size: 169 items typed business/enterprise/public company/company with country Poland and ≥1,000 employees; 2,003 such items with an official website [T] | CC0 for structured data [O WD2]. Thin and uneven for Polish subsidiaries of international groups; transitive class queries time out (HTTP 504 after 65 s) [T]. No HR contacts. |

---

## 7. Legal context that affects provider choice (not legal advice)

1. **GDPR Art. 14** (data not obtained from the data subject): information must be given "at the latest at the time of the first communication" when data are used to communicate with the person [L1, Art. 14(3)(b)], and must include "from which source the personal data originate, and if applicable, whether it came from publicly accessible sources" [L1, Art. 14(2)(f)]. **Implication:** store per-contact provenance (provider, provider record ID, source URLs). Hunter's `sources[]` maps directly onto this; providers without sources leave the app able to say only "obtained from provider X".
2. **Polish e-communications law:** *Prawo komunikacji elektronicznej* (12 July 2024) art. 398 ust. 1 prohibits using telecommunications end devices to send commercial information, including direct marketing, "do abonenta lub użytkownika końcowego, chyba że uprzednio wyraził on na to zgodę" [L2]; breach is an act of unfair competition (ust. 4) [L2]. Commentary states the protection covers legal persons and B2B contacts, with fines up to 3% of revenue or PLN 1,000,000 imposed by the UKE President and a petty-offence provision (art. 448) [3P L3]. Whether a first message that only asks for consent counts as commercial information is **not settled** in the sources read [3P L3]. The owner should get a lawyer's view before sending any cold email.
3. **Provider sourcing risk:** the CNIL Kaspr decision shows that LinkedIn-derived contact data can be unlawful at the source (see §3.4). Prefer providers that disclose public-web sources (Hunter) over LinkedIn-URL-driven tools.

---

## 8. What we tested (2026-10-15, ~09:03–09:16 UTC, from this research container through its HTTPS proxy)

We had **no API keys**. Every test below is either unauthenticated or uses a key the vendor itself publishes as a public test/demo key. No sign-up, purchase or form submission.

| # | Request | Result |
|---|---|---|
| 1 | `GET api.hunter.io/v2/domain-search?domain=example.com` (no key) | HTTP 401, `authentication_failed`, "No user found for the API key supplied" |
| 2 | `GET api.hunter.io/v2/email-verifier?...`, `/v2/account`, `/v2/email-count?domain=ing.pl` (no key) | HTTP 401 each (same error) |
| 3 | `GET api.hunter.io/v2/email-insight?email=info@example.com` (no key; documented as free and key optional) | HTTP 200; returned `mx_records: true`, `disposable: true`, `pattern: false` for example.com |
| 4 | `POST api.apollo.io/api/v1/mixed_people/api_search` (no key) | HTTP 422 `{"error":"Not allowed"}` |
| 5 | `POST api.apollo.io/api/v1/people/match` (no key) | HTTP 422, `AUTH.AUTHENTICATION.API_KEY_REQUIRED` |
| 6 | `GET api.lusha.com/v2/person`, `POST api.lusha.com/v3/contacts/enrich` (no key) | HTTP 401 "missing Authorization header" (a plain `GET /v3/person` returned 404 "no Route matched") |
| 7 | `POST api.prospeo.io/enrich-person`, `/account-information` (no key) | HTTP 400 `INVALID_API_KEY` (as documented) |
| 8 | `POST api.snov.io/v1/oauth/access_token` (no creds); `GET api.snov.io/v2/domain-search/start` (no token) | HTTP 400 "Empty 'client_id' parameter"; HTTP 403 |
| 9 | `GET api.rocketreach.co/api/v2/account/`, `POST .../person/search` (no key) | HTTP 401 "Anonymous requests are not allowed. Please use the test API key." |
| 10 | `POST api.dropcontact.com/v1/enrich/all` (no token) | HTTP 401 "No api key received. Please set 'X-Access-Token' header" |
| 11 | `GET api.zerobounce.net/v2/validate`, `/v2/getcredits` (empty key) | HTTP 403 Cloudflare "error code: 1020" (blocked before reaching the API; inconclusive) |
| 12 | `GET api.neverbounce.com/v4/single/check` (no key) | HTTP 200 with `"status":"auth_failure"` |
| 13 | `GET api.millionverifier.com/api/v3/?api=` (no key) | HTTP 200, `result: "error"`, "No apikey specified" |
| 14 | MillionVerifier with documented demo keys `API_KEY_FOR_OK / _INVALID / _UNKOWN / _DISPOSABLE / _UNVERIFIED / _CATCH_ALL` | `ok` (good), `invalid` (bad, sub `no_mailbox`), `unknown` (risky), `disposable` (bad), `unverified`, `catch_all` (risky); `credits: 0`, `livemode: false` |
| 15 | `GET api.search.brave.com/res/v1/web/search?q=test` (no key) | HTTP 422: header `x-subscription-token` "Field required" |
| 16 | `POST google.serper.dev/search` (no key) | HTTP 403 "Unauthorized. Sign up for a free account." |
| 17 | `POST api.tavily.com/search` (no key) | HTTP 401 "missing or invalid API key" |
| 18 | `POST api.exa.ai/search` (no key) | HTTP 402 "Payment required" (`X402_PAYMENT_REQUIRED`) |
| 19 | `GET serpapi.com/search.json?engine=google&q=test` (no key) | HTTP 200 with results for the generic query `test` (apparently served without a key); a unique query returned HTTP 401 "Invalid API key" |
| 20 | `GET customsearch.googleapis.com/customsearch/v1` (no key) | HTTP 403 "Method doesn't allow unregistered callers" |
| 21 | `GET api-krs.ms.gov.pl/api/krs/OdpisAktualny/0000005459?rejestr=P&format=json` | HTTP 200 JSON (88 KB, ~1 s); structure as in §6; board names and PESEL masked. `OdpisPelny` same number: HTTP 200 (977 KB), 143/143 surname fields masked. Non-existent number `0000000001`: HTTP 404 |
| 22 | GUS BIR: `GET` WSDL URLs | HTTP 400 (service expects SOAP POST) |
| 23 | GUS BIR test environment `Zaloguj` (SOAP 1.2) with the public test key from the official BIR 1.2 instruction | HTTP 200, returned a 20-character session ID |
| 24 | GUS BIR production `Zaloguj` with a dummy all-zero key | HTTP 200 with an empty `ZalogujResult` (no session) |
| 25 | Wikidata SPARQL count queries (descriptive User-Agent) | Transitive-subclass query: HTTP 504 after 65 s. Direct-class queries: 169 Polish businesses with ≥1,000 employees; 2,003 with an official website; 11,202 items typed (transitively) as business with country Poland |
| 26 | Static analysis of official pages: Hunter pricing HTML comparison table; Lusha pricing schema.org data; Prospeo pricing JS bundle; MillionVerifier pricing script; Apollo search docs | Used to read prices that the visible pages render with JavaScript; cited as [O] with that caveat |

**Not tested:** any authenticated call, any real coverage or hit rate for Polish companies, any accuracy or bounce rate, any rate-limit behaviour, any provider's actual handling of Art. 14 or opt-out requests.

---

## 9. Recommendation

### 9.1 Initial stack

| Role | Choice | Why |
|---|---|---|
| Contact data (primary) | **Hunter.io**, start on Free, move to **Starter** after the pilot | Source URLs with first/last-seen dates per email; a found-only finder endpoint; HR department + seniority + job-title + Polish-location filters; verification status and date in every result; API on all plans; EU (Belgium) hosting; simple REST; clear per-email credit model; free account and company-discovery endpoints for budget control [HU1–HU6]. |
| Contact data (secondary, only if the pilot shows thin coverage) | **Prospeo** (Starter) or **Snov.io** (Starter) | Prospeo has an explicit "Learning & Development" department filter [PR7]; Snov.io returns `source_page` and has an `human_resources` filter [SN2]. Prospeo's terms must be read first (could not be fetched). |
| Verification | **Hunter Email Verifier** (inside the same credits); optional **MillionVerifier** for second opinions/re-verification | Store Hunter's raw verifier JSON (status, flags, score, date). MillionVerifier credits never expire; demo keys make adapter tests free [MV1, MV2]. |
| Discovery search | **Tavily** (free Researcher plan) | 1,000 free credits/month, basic search 1 credit, terms do not forbid storing outputs [TA1, TA2, TA5]. Use Brave only with a storage-rights plan [BR1, BR2]. |
| Company facts | **KRS API** (website, legal name, board functions), **GUS BIR** (once the key is granted), **Wikidata** (company list/size) | Free; KRS needs no key [T]. |

Not recommended now: Apollo (API plan access contradictory, no sources, contributor-network sourcing), Lusha (low credits per dollar, no sources, 100 requests/day on Free/Starter), Cognism/ZoomInfo (sales-led enterprise pricing), Kaspr (LinkedIn URL input; CNIL fine), RocketReach (API apparently top tier only; pricing unreadable), Dropcontact (no role search; €79/month), FullEnrich (opaque waterfall sources), Google CSE (closed), Serper/SerpAPI/Exa (storage or source-legitimacy concerns).

### 9.2 Cost at a realistic small volume (~300 domain searches + ~500 verifications per month)

Assumptions: Hunter Domain Search with `department=hr` (and/or `job_titles` for L&D wording, including Polish titles), `location` country `PL`, `seniority=senior,executive`, and **`limit=3`**; Hunter charges 1 credit per email returned and 0.5 per verification [HU1].

| Item | Credits / usage | Monthly cost |
|---|---|---|
| Hunter Domain Search, 300 calls × ≤3 emails | ≤ 900 credits (fewer when a domain has no match; 0 if none) | |
| Hunter Email Verifier, 500 × 0.5 | 250 credits (0 for `unknown`) | |
| **Hunter total** | **≤ 1,150 of 2,000 Starter credits** (≤ 1,750 with `limit=5`) | **$49/month billed monthly, or $408/year (= $34/month)** [O HU1]. VAT treatment not stated on the page. |
| Tavily discovery, e.g. 600 basic searches | 600 of 1,000 free credits | **$0** (beyond the free tier: $0.008 per credit pay-as-you-go [O TA2]) |
| MillionVerifier (optional) | 10,000 credits, never expire | **$39 one-off** [O MV1] |
| KRS / GUS / Wikidata | | $0 |
| **Total** | | **≈ $49/month** (+ optional $39 once) |

Note that Hunter results already contain a verification status and date [HU2], so re-verifying every address immediately is not required; re-verify before sending if the stored verification is older than a chosen threshold, and always store the original result alongside any newer one.

### 9.3 Adapter notes (what to persist, how to cap spend)

- Persist per call: provider name, endpoint, request parameters, timestamp, HTTP status, the **raw JSON response**, and any credits counter the provider returns. For Hunter: per email `value`, `type`, `confidence`, `sources[]` (`uri`, `extracted_on`, `last_seen_on`, `still_on_page`), `verification {status, date}`, `department`, `seniority`, `position`; for the Verifier: `status`, `score`, `smtp_check`, `accept_all`, `block`, `verification` date [HU2].
- Mark each address as **found** (has at least one `sources` entry, or came from `/email-finder/found`) or **generated** (Email Finder result without sources). Do not send to generated addresses without a stricter rule; never relabel `accept_all`/`unknown` as `valid`.
- Spend caps: always pass `limit` on Domain Search (default 10, max 100) [HU2]; check remaining credits with the free account endpoint before each daily run [HU2]; use the free Discover endpoint for company discovery [HU2]; identical repeat searches within the period are counted once [HU1].
- Honour opt-outs locally (suppression list) independently of any provider.

---

## 10. Owner actions

1. **Hunter.io:** create a free account with the business e-mail address; in the dashboard create an API key and store it as `HUNTER_API_KEY` (server-side secret only; sent as the `X-API-KEY` header). Accept Hunter's DPA if offered. Run the pilot on the Free plan's 50 credits (for example 15 known target domains × `limit=2` + 20 verifications) and record hit rates. If the pilot is acceptable, upgrade to **Starter** (monthly $49 to stay flexible, or yearly $408).
2. **Tavily:** create a free Researcher account (no card) and store the key as `TAVILY_API_KEY` (sent as `Authorization: Bearer tvly-...`) [TA3]. Enable pay-as-you-go only if usage exceeds 1,000 credits/month.
3. **Optional, MillionVerifier:** create an account (100 free credits), store the key as `MILLIONVERIFIER_API_KEY`; buy the $39 / 10,000-credit pack only if a second verifier is wanted. Use the vendor's demo keys in automated tests.
4. **GUS BIR (optional):** e-mail regon_bir@stat.gov.pl with the business name, REGON, contact person, e-mail, phone, the **fixed IP address(es)** the worker will call from, and expected concurrent users [GUS1]; store the key as `GUS_BIR_API_KEY`. Skip if the app runs only on serverless functions without a fixed egress IP.
5. **KRS and Wikidata:** nothing to sign up for; configure a descriptive User-Agent with a contact address for Wikidata [WD1].
6. **If a second contact source is needed:** read Prospeo's terms of service and privacy policy in a browser (they could not be fetched) before creating an account; key name `PROSPEO_API_KEY` (sent as `X-KEY`) [PR4]. Alternative: Snov.io Starter (`SNOV_CLIENT_ID` / `SNOV_CLIENT_SECRET`, OAuth client credentials) [SN2].
7. **Brave (only if chosen later):** request a plan with explicit storage rights in writing before storing any result-derived URL [BR1, BR2]; key `BRAVE_SEARCH_API_KEY` (header `X-Subscription-Token`) [T].
8. **Legal (before any send):** obtain advice on PKE art. 398 consent for B2B e-mail in Poland; write a legitimate-interest assessment; prepare the Art. 14 notice text (identity, purpose, legal basis, **source of the data**, rights, opt-out) for the first message [L1, L2, L3].

Key names above are proposals for this app's configuration, not names required by the providers.

---

## 11. Open points and unclear items

- Poland/HR coverage of every provider: **no official figures found**; only a pilot will answer it.
- Apollo API plan eligibility (Custom plans vs. per-plan limits) [AP1 vs AP5].
- Prospeo: legal entity, terms, data storage rights, full list of email statuses, free-plan API (three official statements disagree) [PR1, PR2, PR3].
- Hunter: storage rights are not expressly granted (only not restricted) [HU3]; data-removal window 3 vs 6 months [HU5 vs HU6]; whether Hunter sends Art. 14 notices itself [HU5].
- RocketReach and NeverBounce official pricing pages were unreadable (JavaScript / HTTP 403).
- Kaspr/CNIL details and Cognism API help pages were seen only through search summaries (pages returned 503/403).
- GDPR text was read from a third-party reproduction (gdpr-info.eu) because EUR-Lex returned an empty page to our fetcher; PKE art. 398 from a third-party statute reproduction (standardyprawa.pl). Check both against official sources (EUR-Lex, Dziennik Ustaw) before relying on them.

---

## 12. Sources (all accessed 2026-10-15)

| ID | URL | Type | Used for |
|---|---|---|---|
| HU1 | https://hunter.io/pricing | O | Plans, prices, credits, API on all plans, credit rules FAQ |
| HU2 | https://hunter.io/api-documentation/v2 | O | Filters, sources, statuses, found-only endpoint, rate limits, auth, free endpoints |
| HU3 | https://hunter.io/terms-of-service | O | Controller role, Delaware law, API/abuse clauses, no deletion clause |
| HU4 | https://help.hunter.io/en/articles/1890029-gdpr-compliance | O | Belgium hosting, SCCs, user as controller |
| HU5 | https://hunter.io/privacy-policy | O | Public-web crawling, pattern generation, legitimate interest, claim/opt-out, retention |
| HU6 | https://hunter.io/our-data | O | Index size, crawl rate, 6-month removal, no country claims |
| AP1 | https://www.apollo.io/pricing | O | "API access is available on Custom plans", credits do not roll over |
| AP2 | https://docs.apollo.io/reference/people-api-search | O | 0-credit search, filters, seniorities, email statuses |
| AP3 | https://docs.apollo.io/reference/people-enrichment | O | Credit costs, GDPR-region personal emails, `email_source` |
| AP4 | https://docs.apollo.io/docs/api-pricing | O | Credit consumption varies by plan |
| AP5 | https://docs.apollo.io/reference/rate-limits | O | Rate limits per plan |
| AP6 | https://www.apollo.io/terms | O | Licence, retention after termination, restrictions |
| AP7 | https://www.apollo.io/privacy-policy | O | Contributor database, Art. 14 notice, opt-out |
| AP8 | https://www.zeliq.com/blog/apolloio-pricing | 3P (search summary) | Basic/Professional price claims |
| LU1 | https://www.lusha.com/pricing/ | O | Prices and credits (schema.org data in page), rollover |
| LU2 | https://docs.lusha.com/user-guide/lushas-api/all-there-is-to-know-about-lushas-api.md | O | API on every plan, rate limits, credit charges, AI-training ban |
| LU3 | https://docs.lusha.com/api-reference/overview | O | `api_key` header, 401, endpoints |
| LU4 | https://www.lusha.com/legal/terms_and_conditions-2/ | O | Internal use, post-termination use, deletion on breach, AI restriction |
| LU5 | https://www.lusha.com/privacy/community/ | O | Community data sources, notifications |
| CO1 | https://www.cognism.com/pricing | O | Plans, credit model, API on Standard |
| CO2 | https://www.cognism.com/compliance | O | Legitimate interest, notifications, DNC, EEA |
| CO3 | https://help.cognism.com/hc/en-gb/articles/37382868352914 | O (HTTP 403; search summary only) | Search/Enrich/Redeem APIs and credits |
| CO4 | https://syncgtm.com/blog/best-b2b-database-eastern-europe ; https://webflow.unifygtm.com/explore/b2b-data-providers-european-coverage | 3P (search summary) | Conflicting CEE coverage claims |
| CO5 | https://www.cognism.com/newsroom/kaspr-press-release | O (search summary) | Kaspr acquisition, 27 April 2022 |
| KA1 | https://www.kaspr.io/pricing | O | Plans, prices, API "upon request" |
| KA2 | https://kaspr.io/developers-api | O | LinkedIn URL input, credits, API by plan |
| KA3 | https://www.kaspr.io/privacy-policy | O | Sources (LinkedIn), KASPR SAS, 5-year retention, opt-out |
| KA4 | https://www.cnil.fr/fr/aspiration-de-donnees-sanction-de-240-000-euros-lencontre-de-la-societe-kaspr | O regulator (HTTP 503 to fetcher; search summary) | €240,000 fine, 5 Dec 2024 |
| KA4b | https://next.ink/162375/la-cnil-sanctionne-le-scraping-sauvage-de-linkedin-par-kaspr-dune-amende-de-240-000-euros/ | 3P (search summary) | Fine context |
| KA4c | https://www.lemondedudroit.fr/decryptages/96325-aspiration-donnees-linkedin-kaspr-sanctionne.html | 3P (search summary) | Breaches found |
| KA5 | https://cnil.fr/fr/node/168244 | O regulator (search summary) | Injunction closed 4 March 2026 |
| SN1 | https://snov.io/pricing | O | Plans, API on Starter/Pro, credit costs |
| SN2 | https://snov.io/api | O | Auth, 60 rpm, credits, filters, statuses, `source_page` |
| SN3 | https://snov.io/terms-and-conditions | O | Snovio Inc., Delaware, indemnity for notification failures |
| RR1 | https://rocketreach.co/pricing | O (JS-rendered, unreadable) | — |
| RR2 | https://docs.rocketreach.co/ | O | Endpoints, verify refund on unknown, 429 |
| RR3 | https://docs.rocketreach.co/reference/universal-credits-overview | O | Credit costs per operation |
| RR4 | https://docs.rocketreach.co/reference/rate-limits.md | O (search summary) | Free accounts have no API; api@rocketreach.co |
| RR5 | https://salesintel.io/blog/rocketreach-pricing-plans/ ; https://emelia.io/hub/rocketreach-pricing | 3P (search summary) | API on Ultimate only |
| DC1 | https://www.dropcontact.com/pricing | O | Plans, API, pay on success, no database claim |
| DC2 | https://developer.dropcontact.com/ | O | Auth, endpoints, inputs, qualifications, credits, limits |
| DC3 | https://www.dropcontact.com/terms | O | French SAS, French law, resale ban |
| PR1 | https://prospeo.io/pricing (and its `/_next/static/*.js` bundles) | O (client-rendered) | Fallback price config, feature table, FAQ; terms/privacy/trust pages also client-rendered and unreadable |
| PR2 | https://help.prospeo.io/en/article/plans-and-pricing-overview-cdloq9 | O | Plans, credits, API per plan, rollover |
| PR3 | https://prospeo.io/api-docs | O | Endpoint list, "Free API access for all users" |
| PR4 | https://prospeo.io/api-docs/enrich-person | O | Credits, statuses, `X-KEY`, errors |
| PR5 | https://prospeo.io/api-docs/search-person | O | Search credits, filters, no emails in search |
| PR6 | https://prospeo.io/api-docs/rate-limits | O | Rate limits per plan |
| PR7 | https://prospeo.io/api-docs/enum/departments ; https://prospeo.io/api-docs/enum/seniorities | O | L&D and HR department values; seniorities |
| PR8 | https://help.prospeo.io/en/article/how-do-i-opt-out-my-data-from-prospeo-nmxb4f | O | Legal basis, sources, opt-out |
| PR9 | https://emelia.io/hub/prospeo-pricing | 3P (search summary) | Price claims |
| ZI1 | https://www.zoominfo.com/pricing | O | No public prices, API product |
| FE1 | https://fullenrich.com/pricing | O | Plans, credit costs, waterfall, no contact storage |
| ZB1 | https://www.zerobounce.net/email-validation-pricing | O | PAYG from $39/2,000, freemium 100/month, unknown not charged |
| ZB2 | https://www.zerobounce.net/docs/email-validation-api-quickstart/v2-status-codes | O | Status and sub-status taxonomy |
| NB1 | https://neverbounce.com/pricing | O (HTTP 403) | — |
| NB2 | https://developers.neverbounce.com/docs/verifying-an-email | O | Result values |
| NB3 | https://emelia.io/hub/neverbounce-pricing ; https://bouncezero.io/neverbounce-pricing | 3P (search summary) | ~$0.008/email |
| MV1 | https://www.millionverifier.com/ (and https://www.millionverifier.com/assets/js/main.js pricing table) | O | Prices, never-expire credits, refund, free credits |
| MV2 | https://developer.millionverifier.com/ | O | API, demo keys, result fields |
| GO1 | https://developers.google.com/custom-search/v1/overview | O | Closed to new customers; 1 Jan 2027 |
| BR1 | https://brave.com/search/api/ | O | Prices, free credits, storage-rights FAQ |
| BR2 | https://api-dashboard.search.brave.com/terms-of-service | O | No storing/caching results; deletion on termination |
| SE1 | https://serper.dev/ | O | Free queries, packs, validity |
| SE2 | https://serper.dev/terms | O | Terms (UK law; no storage clause) |
| TA1 | https://www.tavily.com/pricing | O | Free plan, PAYG |
| TA2 | https://docs.tavily.com/documentation/api-credits | O | Credit costs, plan table |
| TA3 | https://docs.tavily.com/documentation/api-reference/endpoint/search | O | Auth header, parameters, response fields |
| TA4 | https://docs.tavily.com/documentation/rate-limits | O | Dev/prod rate limits |
| TA5 | https://www.tavily.com/terms | O | Internal business purposes, data-mining clause, New York law |
| EX1 | https://exa.ai/pricing | O | Prices, free credits |
| EX2 | https://exa.ai/terms | O | §4.2(a) copying restriction |
| SA1 | https://serpapi.com/pricing | O | Plans, free plan, Legal Shield |
| KRS1 | https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/0000005459?rejestr=P&format=json | T | Tested structure and masking |
| KRS2 | https://prs.ms.gov.pl/krs/openApi | O (no readable content) | — |
| GUS1 | https://api.stat.gov.pl/Home/RegonApi | O | Key procedure, free of charge, limits |
| GUS2 | https://api.stat.gov.pl/Content/files/regon/GUS-Regon-UslugaBIRver1.2-dokumentacjaVer1.4.zip | O | Test key and environment, data schemas (e-mail/website/phone fields) |
| WD1 | https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual | O | Query limits, User-Agent policy |
| WD2 | https://www.wikidata.org/wiki/Wikidata:Licensing | O | CC0 for structured data |
| L1 | https://gdpr-info.eu/art-14-gdpr/ | 3P reproduction of GDPR | Art. 14(2)(f), 14(3) |
| L2 | https://standardyprawa.pl/akt/532/art/63603 | 3P reproduction of statute | PKE art. 398 text |
| L3 | https://www.prawo.pl/biznes/zgody-marketingowe-i-kontakty-handlowe-co-mowi-prawo-komunikacji-elektronicznej,530981.html | 3P commentary | B2B scope, penalties |
