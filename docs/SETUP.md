# Setup

Everything except the database and the login is optional. Without a key, that part of the app shows "awaiting configuration" (*oczekuje na konfigurację*) and the rest keeps working.

| Integration | Needed for | Cost | Without it |
|---|---|---|---|
| Postgres | everything | free locally; Neon Free in production | – |
| Anthropic API | email drafts, rewrites, material summaries, optional AI-assisted page reading | pay per use | you write emails yourself in the composer |
| Hunter | finding named people's email addresses, verification | Free plan: 50 credits/month | discovery uses public websites only (free) |
| Tavily | finding deeper pages (academy, supplier portal, HR team) on a company's own site when its menus lead nowhere | free plan: 1,000 credits/month | only pages linked from the company's homepage are read |
| Gmail | sending from the app, reply tracking | free | copy the email, send it yourself, click *Oznacz jako wysłaną ręcznie* |

## 1. Local development

Requirements: Node.js 22+, pnpm 10 (`corepack enable`), PostgreSQL 16.

```bash
# Postgres (example for a local install)
createuser mtg --pwprompt            # password: mtg
createdb -O mtg mtg_dev
createdb -O mtg mtg_test             # only for integration tests

pnpm install
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
DATABASE_URL=postgres://mtg:mtg@localhost:5432/mtg_dev
TEST_DATABASE_URL=postgres://mtg:mtg@localhost:5432/mtg_test
APP_URL=http://localhost:3000
SESSION_SECRET=…        # openssl rand -base64 48
TOKEN_ENCRYPTION_KEY=…  # openssl rand -base64 48 (a different value)
CRON_SECRET=…           # openssl rand -hex 16
```

Then:

```bash
pnpm hash-password       # type a password (12+ characters); put the output in APP_PASSWORD_HASH
pnpm db:migrate
pnpm research:import     # ~370 researched companies
pnpm seed:brand          # draft programmes and profile facts from leadersmindthegap.com (unapproved)
pnpm dev
```

Open http://localhost:3000 and log in.

First steps in the app:
1. **Materiały → Profil:** check the facts about you and approve the ones the AI may use. Unapproved facts are never used.
2. **Materiały → Programy:** check the three draft programmes, upload your offer files (PDF, DOCX, PPTX, JPG, PNG), approve.
3. **Kontakty → Odkrywanie:** check the schedule and limits, then *Uruchom teraz* for a first run.

## 2. Anthropic API (AI drafting)

1. Create an API key at [console.anthropic.com](https://console.anthropic.com/) (Settings → API keys). Add a payment method or credits.
2. Set `ANTHROPIC_API_KEY`. The models default to `claude-opus-5-5`; override with `AI_MODEL` (drafting) and `AI_MODEL_FAST` (summaries, page reading).
3. Restart the app. Ustawienia → Integracje shows the AI as configured.

Cost control: drafting runs only when you click. Each AI call is recorded in Aktywność with an estimated cost. Automatic AI page reading during discovery is **off** by default; if you switch it on (Odkrywanie → Ustawienia przebiegu), it counts against the daily and monthly discovery limits. The estimate uses *Szacowany koszt AI (USD za mln tokenów)*: an assumption you should set from [Anthropic's pricing page](https://www.anthropic.com/pricing) for your model.

## 3. Hunter (contact data, optional)

1. Create an account at [hunter.io](https://hunter.io/). The Free plan gives 50 credits a month and includes the API.
2. Copy the key from Dashboard → API and set `HUNTER_API_KEY`.
3. In Ustawienia → Integracje, set the monthly credit limit to match your plan (50 on Free, 2,000 on Starter).

What it is used for and what it costs, per [research/PROVIDERS.md](research/PROVIDERS.md):
- **Domain search** for companies where the website gave no relevant person: 1 credit per email returned, capped at 3 results per search (setting).
- **Email finder** for named people without an address: found-only mode by default (addresses seen on public web pages, not guessed), 1 credit when found.
- **Verifier:** 0.5 credit, free when the result is "unknown".

Every Hunter result keeps the source pages Hunter reports. Guessed (pattern) addresses are labelled and never count as ready.

## 4. Tavily (site search, optional)

1. Create a key at [tavily.com](https://tavily.com/) (free plan: 1,000 credits a month).
2. Set `TAVILY_API_KEY`. The monthly credit limit is in Ustawienia → Integracje.

It is used only when a company's website, read from its homepage links, gives no relevant person or department mailbox: one search (1 credit) limited to that company's own domains, then up to four of the suggested pages are read politely. New companies are found through Wikidata, which is free.

## Gmail (optional)

Without Gmail you can still do everything: the composer has *Kopiuj*, *Otwórz w programie pocztowym* and *Oznacz jako wysłaną ręcznie*, and replies can be logged by hand in the contact panel.

To send from the app ([research/GMAIL.md](research/GMAIL.md) explains each choice):

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Gmail API**.
2. **OAuth consent screen:**
   - User type **External** for a personal @gmail.com account; **Internal** if you use Google Workspace.
   - Add the scopes `openid`, `email`, `https://www.googleapis.com/auth/gmail.send` and, for reply tracking, `https://www.googleapis.com/auth/gmail.metadata`.
   - For External: click **Publish app** ("In production"). Don't submit it for verification: apps for personal use (fewer than 100 users) are exempt, and you will click through an "unverified app" screen once. Do not stay in *Testing*: there Google expires the authorisation after 7 days.
3. **Credentials → Create OAuth client ID**, type *Web application*. Authorised redirect URI: `<APP_URL>/api/google/callback` (locally `http://localhost:3000/api/google/callback`).
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, restart.
5. Ustawienia → Gmail → *Połącz Gmail*. Sending asks only for permission to send. Reply tracking asks separately for read access to message metadata (headers, not content).
6. Real sending stays off until `SENDING_ENABLED=true`. Send a test to yourself first.

If Google later rejects the stored authorisation (for example after a password change), the app pauses sending and shows *Połącz ponownie (wysyłka)*.

## Tests

```bash
pnpm verify                  # Biome + TypeScript + all tests
pnpm test                    # tests only; integration tests need TEST_DATABASE_URL (a database they may wipe)
```
