# Mind The Gap — Outreach Studio

A private, single-user tool for [Mind the Gap](https://leadersmindthegap.com/). It does three things:

1. **Finds the right people** at large companies operating in Poland: the departments that plan, organise, buy or fund training (HR, L&D, procurement, business leaders, transformation). Every contact keeps its source, how it was found and how fresh the evidence is.
2. **Writes the first email** for each person in Polish or English, from approved facts and programme materials only. Two subject lines, an editable draft, quick rewrites, and an explanation of what was personalised and why.
3. **Tracks who was contacted**, when, and who replied. It sends through Gmail when Gmail is connected; otherwise you copy the text into your mail client and mark it as sent.

It is deliberately not a CRM: no pipelines, deals or forecasts.

The interface is in Polish. The code and docs are in English.

## Screens

| Tab | What it is for |
|---|---|
| **Kontakty** | The contact table: filters (department, role, data quality, email check, outreach status…), saved views, a side panel with evidence and history, CSV import and export. Sub-pages: **Firmy** (companies and research status) and **Odkrywanie** (discovery schedule, budgets, runs, *Run now*). |
| **Wiadomości** | Drafts, scheduled, sent and replied messages, and the composer. |
| **Materiały** | Programmes, uploaded offers (PDF, DOCX, PPTX, JPG, PNG), and the sender profile with the facts the AI is allowed to use. |
| **Aktywność** | Simple numbers: new contacts, emails sent, replies, cost. |
| **Ustawienia** | Gmail, integrations, freshness and outreach rules, privacy (suppression list, retention, exports). |

## How it works in one paragraph

A scheduler calls `/api/cron/tick` every hour. Once a day, at 07:00 Warsaw time, a tick starts a discovery run: it finds new companies, crawls company websites politely (robots.txt, delays, honest User-Agent), extracts people and department mailboxes with verbatim evidence, and, if a paid provider is configured and the budget allows, looks up missing email addresses. Every other tick sends scheduled emails, syncs replies and does housekeeping. All of it is idempotent, so a missed or duplicated tick is harmless. Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start (local)

Requirements: Node.js 22+, pnpm 10, PostgreSQL 16.

```bash
pnpm install
cp .env.example .env.local        # fill in DATABASE_URL and the secrets
pnpm hash-password                # paste the output into APP_PASSWORD_HASH
pnpm db:migrate
pnpm research:import              # loads the researched company universe (research/companies/universe.jsonl)
pnpm seed:brand                   # draft programmes and unapproved profile facts from the website
pnpm dev                          # http://localhost:3000
```

Run discovery by hand: `pnpm worker run-now --seconds 600`, or click *Uruchom teraz* in Kontakty → Odkrywanie.

Full setup, including the optional AI, Hunter, Tavily and Gmail keys: [docs/SETUP.md](docs/SETUP.md). Hosting: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Commands

```bash
pnpm dev            # development server
pnpm verify         # lint (Biome) + typecheck + tests: run before every commit
pnpm test           # unit tests; integration tests run when TEST_DATABASE_URL is set
pnpm db:generate    # new migration after changing src/server/db/schema.ts
pnpm db:migrate     # apply migrations to DATABASE_URL
pnpm worker tick                 # one scheduler tick (what the cron does)
pnpm worker run-now --seconds N  # start or continue a discovery run for N seconds
pnpm worker research <domain>    # research one company now
```

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Data model, job engine, discovery pipeline, AI drafting, Gmail, privacy |
| [docs/SETUP.md](docs/SETUP.md) | Local setup and every integration, step by step |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel + Neon, the scheduler, the Cloud Run alternative |
| [docs/COSTS.md](docs/COSTS.md) | What costs money, the defaults, how budgets are enforced |
| [docs/COMPLETION.md](docs/COMPLETION.md) | What works, what waits for configuration, what is partial or missing |
| [docs/research/TRAINING-BUYERS.md](docs/research/TRAINING-BUYERS.md) | Which departments buy training, and how the app targets them |
| [docs/research/PROVIDERS.md](docs/research/PROVIDERS.md) | Contact-data providers compared from official docs |
| [docs/research/GMAIL.md](docs/research/GMAIL.md) | Gmail API scopes, limits, sending and reply sync |
| [docs/research/LEGAL-PL.md](docs/research/LEGAL-PL.md) | Polish and EU rules for B2B email outreach (not legal advice) |
| [docs/research/HOSTING.md](docs/research/HOSTING.md) | Hosting options and prices |

## Data and privacy

This repository is public. It contains code, documentation and the researched list of companies (public business information). **It never contains contact data.** Contacts live only in the database. Exports go to your computer and are git-ignored (`*.contacts.csv`, `exports/`, `.private/`).
