# Deployment

**Current production (set up 2026-10-15):** https://mindthegap-outreach.vercel.app — Vercel project `mindthegap-outreach` (Hobby, region `fra1`), deploying from the repository's default branch; database: Neon project `mindthegap` (Frankfurt, Postgres 18). The tables were created and the researched data copied with `scripts/push-to-neon.ts` (HTTPS, because the setup environment could not reach Postgres directly). Environment variables are set in Vercel for Production only.

The app needs three things in production: the Next.js app, a Postgres database, and a scheduler that calls `/api/cron/tick` every hour. The recommended setup costs nothing fixed: **Vercel + Neon**, with Vercel's own cron jobs.

> **Plan choice is yours.** Vercel's terms say "Hobby teams are restricted to non-commercial personal use only", and list "advertising the sale of a product or service" as commercial ([docs/research/HOSTING.md](research/HOSTING.md) §1). You said the tool is for your own use and not for sale. It does, however, support outreach for your training business, so it may count as commercial use under those terms. If you want to be certain, use Vercel Pro ($20/month) or the Cloud Run setup below (about $0–6/month). Nothing in the code depends on the plan.

## Option A: Vercel + Neon (recommended)

### 1. Database (Neon)

1. Create a Neon project in **AWS Europe Central 1 (Frankfurt)**.
2. Copy the **pooled** connection string (the host contains `-pooler`), with `sslmode=require`.
3. From your computer, apply the migrations and load the data:

   ```bash
   DATABASE_URL='postgres://…-pooler…/neondb?sslmode=require' pnpm db:migrate
   DATABASE_URL='…' pnpm research:import
   DATABASE_URL='…' pnpm seed:brand
   ```

   The scripts read the other required values from `.env.local`, so keep that file filled in.

Neon Free is enough to start (0.5 GB storage). The app wakes the database once an hour, which uses compute hours; if you hit the Free limit, the Launch plan has no minimum fee ([HOSTING.md](research/HOSTING.md) §3).

### 2. App (Vercel)

1. Import the GitHub repository into Vercel. Framework: Next.js (detected). Region: `fra1` is set in `vercel.json`.
2. Add the environment variables (Project → Settings → Environment Variables), for **Production**:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Neon pooled string |
   | `APP_URL` | your production URL, e.g. `https://outreach-yourname.vercel.app` |
   | `APP_PASSWORD_HASH` | from `pnpm hash-password` |
   | `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` | two different random strings, 32+ characters (`openssl rand -base64 48`) |
   | `CRON_SECRET` | a random string; Vercel sends it to the cron endpoint automatically |
   | `DB_POOL_MAX` | `2` |
   | optional | `ANTHROPIC_API_KEY`, `HUNTER_API_KEY`, `TAVILY_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JOOBLE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SENDING_ENABLED` |

   Keep `TOKEN_ENCRYPTION_KEY` safe: changing it makes the stored Gmail tokens unreadable, and you would have to reconnect Gmail.
3. Deploy. Open the URL and log in.
4. **Deployment protection:** the app has its own login, so Vercel's preview protection is optional. Previews share the production database only if you give them the same `DATABASE_URL`; don't, or leave preview variables empty.

### 3. Scheduler

`vercel.json` defines 24 daily cron jobs (one per hour, at minute 5 UTC), because the Hobby plan allows each cron job to run at most once a day. Each call runs one tick (up to `TICK_BUDGET_SECONDS`, default 270 s, under Hobby's 300 s function limit).

What to expect:
- **On Hobby, timing is approximate:** Vercel may start an hourly job anywhere within that hour. The daily discovery run therefore starts **between 07:00 and 07:59 Warsaw time**, and a scheduled email may go out up to an hour after its time. On Pro the jobs run on the minute.
- **Exact timing on Hobby (optional, free):** create a job on [cron-job.org](https://cron-job.org) or any external scheduler that sends `POST https://<your-app>/api/cron/tick` with the header `Authorization: Bearer <CRON_SECRET>` every 15 minutes. Duplicate ticks are safe.
- A long discovery run continues over several ticks. *Uruchom teraz* in Kontakty → Odkrywanie drives the work from your browser in 40-second slices while the page is open.

Check it works: Kontakty → Odkrywanie shows the time of the last tick and the next scheduled run.

### 4. Gmail (optional)

Follow [SETUP.md](SETUP.md#gmail-optional). The authorised redirect URI must be `https://<your-app>/api/google/callback`. Set `SENDING_ENABLED=true` only when you are ready to send real emails, and redeploy.

### 5. Updating

Push to the production branch; Vercel redeploys. If the change includes a new file in `drizzle/`, run `pnpm db:migrate` against the Neon URL **before** the deploy goes live.

## Option B: Google Cloud Run + Cloud Scheduler + Neon

Cheapest with no plan restrictions (about $0–6/month, mostly Neon), but it needs a Google Cloud billing account with a payment method ([HOSTING.md](research/HOSTING.md) §2 and §7).

Outline (not yet tried end to end with this repository):

1. Same Neon setup as above.
2. Build the app as a container. `next.config.ts` already uses `output: "standalone"`; a Dockerfile still has to be added (Node 22, `pnpm install --frozen-lockfile`, `pnpm build`, run `node .next/standalone/server.js`).
3. `gcloud run deploy` in `europe-central2` (Warsaw) or `europe-west3` (Frankfurt), min instances 0, request timeout 300 s, the same environment variables (better: Secret Manager).
4. Cloud Scheduler job: `POST https://<service>/api/cron/tick`, header `Authorization: Bearer <CRON_SECRET>`, schedule `*/15 * * * *` or `5 * * * *`. Cloud Scheduler accepts a time zone, but the app already handles Warsaw time itself.

## Local or self-hosted scheduler

Any machine can run the scheduler instead: `pnpm worker tick` from cron, or `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/tick`. The CLI needs the same environment variables and network access to the database.

## Checklist before real use

- [ ] Log in works on the production URL; a wrong password is rate-limited.
- [ ] Kontakty → Odkrywanie shows a recent "last tick".
- [ ] Materiały: approve your profile facts and at least one programme (nothing unapproved is used in emails).
- [ ] Ustawienia → Prywatność: controller name and the information footer are correct.
- [ ] Read [research/LEGAL-PL.md](research/LEGAL-PL.md): sending is blocked until each contact has a documented basis (contact panel → *Uprawnienie do kontaktu* → *Zmień*), on purpose. The rule can be switched off in Ustawienia → Korespondencja, at your own risk.
- [ ] Only then: connect Gmail, set `SENDING_ENABLED=true`, send one email to yourself first.
