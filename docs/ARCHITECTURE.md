# Architecture

One Next.js application and one Postgres database. Background work runs in short, resumable slices triggered by a scheduler, so the same code runs on a serverless host (Vercel), on a container host (Cloud Run) or from the command line.

```
 browser ──► Next.js (App Router, server components + API routes) ──► Postgres
                 ▲                                                     ▲
 scheduler ──► /api/cron/tick ──► job engine ──► crawler, providers, AI, Gmail
 (hourly)                          (leases, tasks, budgets)
```

## Stack

| Area | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript strict. `src/proxy.ts` sets a nonce-based CSP and protects every page and API route. |
| Database | PostgreSQL 16, Drizzle ORM, postgres.js. Migrations in `drizzle/`. |
| Validation | Zod at every boundary: HTTP bodies, settings, provider responses, AI output. |
| AI | Anthropic Claude API through `src/server/ai/client.ts` (structured output, server-side model fallback). |
| Crawling | Native `fetch` with a polite wrapper (`src/server/discovery/fetcher.ts`), Cheerio for HTML. |
| Files | Uploaded materials are stored in Postgres (`file_chunks`, 2 MB chunks, 15 MB per file), so there is no second storage service. |
| Tests | Vitest (unit and integration). Biome for lint and format. |

## Code map

```
src/
  app/(app)/        the five tabs: kontakty, wiadomosci, materialy, aktywnosc, ustawienia
  app/api/          JSON API used by the screens, plus /api/cron/tick
  components/       shared UI (table cells, panel, dialogs, toasts)
  lib/              pure logic shared by server and browser: roles, contact rules, email lint, CSV, time
  server/
    db/             schema and client
    discovery/      company discovery, crawler, extraction, provider enrichment, verification
    providers/      Hunter, Tavily, Wikidata, DNS-MX
    jobs/           runs, tasks, leases, budgets, the tick
    ai/             compose (emails), materials summaries, assisted extraction
    gmail/          OAuth, sending, reconciliation, reply sync
    materials/      uploads and text extraction (PDF, DOCX, PPTX, images)
    services/       contacts, messages, companies, privacy, activity
  worker/cli.ts     the same jobs from the command line
scripts/            migrate, import research, seed brand, hash password
research/           the researched company universe (public business data)
```

## Data model (main tables)

- **companies**: name, brand, domain(s), sector, size with source, Polish presence with source, parent group, research status and outcome, next research date. `company_sources` holds the evidence URLs.
- **contacts**: a person, a department inbox or a general inbox at a company. Separate fields for separate questions:
  - *role relevance*: `role_category` (likely decision-maker, organiser/influencer, departmental inbox, general routing, uncertain) and `role_function` (HR, L&D, procurement, business leadership, transformation, culture, other);
  - *employment freshness*: `employment_status` and the date of the newest evidence;
  - *email verification*: `email_status` (not checked, valid, invalid, catch-all, unknown, expired) and `email_origin` (published on a page, provider with sources, provider pattern, entered by hand, imported);
  - *communication eligibility*: `eligibility_basis` (not assessed, consent, invitation to send offers, prior relationship, other documented, do not contact) with a note and a date;
  - derived fields recomputed by code: `quality` (ready, caution, needs research, blocked) and `outreach_status`.
- **contact_evidence**: every claim with its source (URL and verbatim quote, provider and reference, or "entered by you"). `contact_events` is the history; `contact_verifications` records each check.
- **messages**, **message_revisions**, **message_attachments**, **send_attempts**, **inbound_messages**: drafts with full revision history, the approval snapshot, sending attempts and detected replies.
- **programs**, **documents**, **document_versions**, **file_chunks**: the materials library.
- **job_runs**, **job_tasks**, **leases**, **provider_usage**, **host_state**, **fetch_log**: the job engine, budgets and crawler politeness state.
- **suppressions**: emails, domains, companies or contacts that must never be contacted, including SHA-256 fingerprints kept after erasure.
- **settings**: all user settings as validated JSON (`src/server/settings.ts`).

## Job engine

`src/server/jobs/`

- **Tick** (`tick.ts`): the scheduler calls `/api/cron/tick` (or `pnpm worker tick`). Each duty takes its own lease, so overlapping ticks never do the same work twice: send due emails, sync replies (every `replySyncIntervalMinutes`), refresh follow-ups, daily retention clean-up, and discovery.
- **Daily schedule:** a scheduled run is created when the Europe/Warsaw local time is within `onTimeWindowMinutes` after `localTime` (07:00 by default). The timezone library handles summer and winter time. `job_runs` has a unique index on (kind, local date), so duplicate cron calls create one run. A tick that arrives late the same day creates a `catch_up` run. Missed days are not backfilled. Pause, resume, schedule changes and *Run now* are in Kontakty → Odkrywanie.
- **Runs and tasks** (`runs.ts`): planning turns a run into tasks (maintenance, find companies, research company, enrich, verify email, recheck employment), each unique per run. Workers claim tasks with `FOR UPDATE SKIP LOCKED`, retry with exponential backoff, and give up after `maxAttempts`. A stuck task is released after its lease expires. A run ends as succeeded, partial, failed or budget exhausted, with honest stats.
- **Budgets** (`budget.ts`): every paid call reserves its maximum cost first (under an advisory lock), then commits the real cost or releases the reservation on failure. Daily and monthly USD limits and monthly credit limits per provider stop paid work; free work (crawling) continues.

## Discovery pipeline

1. **Companies.** The initial universe of ~370 companies came from desk research with sources (`research/companies/`). New ones come from Wikidata (free) and, if configured, Tavily web search. Companies below the size threshold or outside the chosen sectors are skipped.
2. **Crawling** (`research-company.ts`, `extract.ts`): the homepage, then the highest-scoring section links (academy and training, supplier and procurement pages, contact, management, HR and careers, about), the sitemap only when the homepage has few links. robots.txt is obeyed (a server error means "disallowed"), each host gets a minimum delay, redirects are checked, responses are size-capped, and the User-Agent names the app and a contact page.
3. **Extraction:** email addresses with their surrounding text block, people from the same card or block (name + title), role blocks, and the page's publication date. Optional AI-assisted extraction must return text that is verbatim in the page, or it is discarded.
4. **Classification:** `src/lib/roles.ts` assigns role category and department from the title; `classifyMailbox` labels addresses (development, HR, procurement, recruiting, generic, personal). See [research/TRAINING-BUYERS.md](research/TRAINING-BUYERS.md).
5. **Storing:** contacts are deduplicated by email and by name within the company. Rejected and suppressed contacts never come back. Stored contacts are spread across departments first, up to `maxContactsPerCompany`. The company gets a research outcome (relevant contact found, person found without email, department without named contact, general contact only, needs provider enrichment, no suitable contact, source unavailable, incomplete) and a revisit date.
6. **Enrichment (paid, optional):** Hunter domain search for companies without a relevant contact, and email finder for named people without an address. Pattern-guessed addresses are labelled as such and never count as ready.
7. **Verification:** a free DNS MX check (can only prove an address invalid) and, optionally, Hunter's verifier. Old checks expire after the freshness setting.

## Emails

- **Context** (`ai/compose.ts`): only approved facts are sent to the model, each with an id: the sender profile facts you approved, approved programme summaries and quotable materials, the recipient's published title and department, company facts with sources, research signals, and the subjects of our own earlier emails. No other personal data, and never reply contents.
- **Generation:** two subject lines, a body, a shorter and a bolder variant, the call to action, and which fact ids support each personalised point. The emphasis adapts to the recipient's department (procurement gets a brief factual note, a business leader gets the team outcome).
- **Checks:** a deterministic linter (`lib/email-lint.ts`) flags fake "Re:", urgency, guarantees, unsupported numbers, unapproved links or addresses, clichés, TikTok endorsement and length. One automatic repair pass, then the findings are shown.
- **Editing:** autosave with optimistic revisions, restore any revision, quick actions (shorter, more direct, warmer, stronger value, better opening, change the CTA, rewrite a selection).
- **Approval and sending:** approval stores a hash of exactly what will be sent; any edit voids it. Before sending, code checks the suppression list, data quality, eligibility basis, recent contact with the same company and the daily limit. The final text gets the signature and, on a first message, the GDPR Art. 14 information footer.

## Gmail (optional)

- Incremental OAuth with PKCE: *send* asks for `gmail.send`; reply tracking separately asks for `gmail.metadata`. Tokens are encrypted with AES-256-GCM.
- Send states: approved or scheduled → sending → sent, failed or uncertain. An uncertain send (for example a timeout) is never retried automatically; it is reconciled by looking for our Message-ID in the Sent folder.
- Reply sync reads thread metadata only and classifies human replies, auto-replies and bounces.
- Real sending is off unless `SENDING_ENABLED=true`.
- Without Gmail, the composer offers *Copy*, *Open in mail app* and *Mark as sent*, and replies can be logged by hand.

## Security and privacy

- One owner, one password (scrypt hash in an environment variable), database sessions, login rate limiting, same-origin checks on every mutation, strict CSP with nonces, no secrets in the browser bundle.
- Fetched pages, uploaded documents and incoming email are data, never instructions: AI prompts mark them as untrusted, and no AI output can trigger a send or change settings.
- Suppression list, erasure with fingerprints, retention clean-up, per-contact and full exports. Demo data, if ever used, is flagged `is_demo` and excluded from lists and sending.
