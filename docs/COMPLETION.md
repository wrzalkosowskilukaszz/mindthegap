# Completion matrix

State on 2026-10-15. What each status means:

- **Operational:** built, tested, and used against real data in this environment.
- **Awaiting configuration:** built and tested with simulated responses, but it needs a key or account you provide (it has never run against the real service here).
- **Partial:** works, with a stated limit.
- **Not implemented:** not built yet.

How it was checked: 136 unit and integration tests (`pnpm test`), 6 Playwright smoke tests on desktop and phone (`pnpm e2e`), Biome and TypeScript clean, a production build, and full discovery sweeps over the ~420-company universe on a local database.

## Contacts and discovery

| Feature | Status | Notes |
|---|---|---|
| Company universe (~370 researched companies with sources) | Operational | `research/companies/universe.jsonl`, imported with `pnpm research:import`. |
| New companies from Wikidata | Operational, partial | Free. Public bodies, schools, associations, foreign domains and duplicates are filtered out; only companies in a sector you research are added. Wikidata has a limited pool of Polish companies with size data (about 220 candidates), so after a few weeks it stops finding new ones. Manual add and CSV import cover the rest. |
| Polite crawler (robots.txt, delays, honest User-Agent, size limits) | Operational | |
| Extraction of people, titles and mailboxes with verbatim quotes | Operational, partial | Works on pages that publish names and titles in text. Most Polish company sites publish few named HR/L&D people, so many companies end with a department mailbox or a general address. Every outcome is recorded honestly per company. |
| Departments that buy training (HR, L&D, procurement, business leaders, transformation, culture) | Operational | [research/TRAINING-BUYERS.md](research/TRAINING-BUYERS.md). Filter *Dział* in Kontakty; editable per contact. |
| Quality guards (press/investor/sales mailboxes, R&D "rozwój", foreign subsidiaries, materials purchasing) | Operational | Added after reviewing the first real sweep. |
| Your keyword lists (include / exclude titles) | Operational | Odkrywanie → Ustawienia przebiegu. |
| Site search when a site's menus lead nowhere (Tavily) | Awaiting configuration | `TAVILY_API_KEY`. Budgeted; only the company's own domains. |
| AI-assisted reading of pages | Awaiting configuration | `ANTHROPIC_API_KEY`, then switch on in Ustawienia przebiegu. Off by default; budgeted; verbatim-checked. |
| Hunter: domain search, email finder (found-only), verifier | Awaiting configuration | `HUNTER_API_KEY`. Spend capped by credits and USD limits. |
| Free email check (DNS MX) | Operational | Can only prove an address invalid; never marks it valid. |
| Employment re-check (source page still lists the person) | Operational | Free; runs on stale contacts. |
| Research outcome and coverage per company (*Firmy i pokrycie*) | Operational | |
| Contact table: views, filters, search, sort, keyboard, bulk actions, side panel with evidence | Operational | Desktop table; two-line list on phones. |
| CSV import and export | Operational | Exports go to your computer only. |

## Scheduling and jobs

| Feature | Status | Notes |
|---|---|---|
| Daily run at 07:00 Warsaw (DST-correct), one per day, same-day catch-up, no backfill | Operational in code | Needs a scheduler in production (Vercel Cron in `vercel.json`, or any cron). On Vercel Hobby the run starts between 07:00 and 07:59. |
| Pause / resume / change time / *Uruchom teraz* | Operational | |
| Leases, retries with backoff, idempotent tasks, honest run statuses | Operational | |
| Spending limits (daily, monthly, credits per provider) | Operational | Reservation before each paid call. AI you start yourself is recorded but does not consume the automatic limits ([COSTS.md](COSTS.md)). |

## Emails

| Feature | Status | Notes |
|---|---|---|
| Materials: programmes, uploads (PDF, DOCX, PPTX, TXT, JPG, PNG, WEBP), versions, approvals | Operational | Text extraction runs locally. Images need AI to be summarised. |
| Programme summaries proposed from your files, with verified quotes | Awaiting configuration | `ANTHROPIC_API_KEY`. |
| Sender profile and approved facts | Operational | Seeded from your website and brief as **unapproved**; nothing is used until you approve it. The profile tab saves by itself. |
| Signature | Operational | Built from your name, position, company and website unless you write your own. Shown under the text on the email screen and editable there (*Edytuj podpis*). |
| Composer: editing, autosave, revisions and restore, deterministic checks (linter) | Operational | |
| Free drafts from templates (per department, PL/EN, first email and follow-up), copy-to-ChatGPT/Claude prompt | Operational | Used whenever no AI key is set: no cost. |
| AI drafting (two subjects, variants, explanation, quick rewrites), PL/EN, department-specific angle | Awaiting configuration (optional) | `ANTHROPIC_API_KEY`, paid per use. Not yet run against the real API in this environment. |
| Approval snapshot, pre-send checks (suppression, basis, recent contact with the company, daily limit), information footer | Operational | |
| Copy / open in mail app / mark as sent by hand; log a reply by hand | Operational | The full workflow works without Gmail and without a separate approval step: *Kopiuj* or *Otwórz w poczcie*, then *Wysłane*. If the recipient has no recorded basis, the email screen asks for it in plain words first (one click when the company's page invites offers to that address). |
| Gmail: connect (incremental scopes), send, schedule, reconcile uncertain sends, reply sync with auto-reply and bounce detection | Awaiting configuration | Google OAuth client ([SETUP.md](SETUP.md#gmail-optional)). Sending also needs `SENDING_ENABLED=true`. Not yet run against a real Google account. |

## Activity, privacy, security

| Feature | Status | Notes |
|---|---|---|
| Aktywność: counts, replies, waiting, costs, day-by-day chart | Operational | |
| Suppression list, erasure with fingerprints, retention clean-up, exports | Operational | |
| Eligibility basis per contact; sending blocked without it (can be switched off) | Operational | Based on [research/LEGAL-PL.md](research/LEGAL-PL.md); not legal advice. |
| Single-owner login, sessions, rate limiting, CSP, same-origin checks | Operational | |

## Delivery

| Feature | Status | Notes |
|---|---|---|
| Documentation (README, architecture, setup, deployment, costs, research) | Operational | |
| Look and feel | Operational | Owner's reference (2026-10-15): grey canvas, white rounded cards, green accent, number cards on Kontakty, a greeting animation after login. |
| Production deployment | Operational | https://mindthegap-outreach.vercel.app (Vercel Hobby + Neon Frankfurt). Smoke tests pass on desktop and phone; the hourly scheduler runs and researched 40 companies in its first tick. |
| Coverage report from the first full sweep | In progress | Written after the sweep finishes: `docs/COVERAGE.md` (aggregate numbers only, no personal data). |
| Job offers tab (*Oferty pracy*) | Not implemented | Planned next step, after the core is in use. |
