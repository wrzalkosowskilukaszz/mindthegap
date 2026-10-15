# Costs

Nothing in the app buys anything by itself. Paid services are used only when you add their key, and automatic paid work stops at the limits you set. Prices below come from the providers' official pages as read on 2026-10-15 ([research/PROVIDERS.md](research/PROVIDERS.md), [research/HOSTING.md](research/HOSTING.md)); check them again before you subscribe.

## Monthly picture

| Item | Free option | Paid option | Notes |
|---|---|---|---|
| Hosting (Vercel) | Hobby: $0 | Pro: $20/month | See the plan note in [DEPLOYMENT.md](DEPLOYMENT.md). Alternative: Cloud Run, about $0 plus Neon. |
| Database (Neon) | Free: $0 (0.5 GB) | Launch: usage-based, about $3/month at this load | Hourly ticks wake the database. |
| Contact data (Hunter) | Free: 50 credits/month | Starter: $49/month or $408/year, 2,000 credits/month | Optional. Without it, discovery uses public websites only. |
| Site search (Tavily) | Free: 1,000 credits/month | pay as you go | Optional. At most one search per researched company, only when its site gave nothing relevant. |
| AI (Anthropic) | – | pay per token | Optional. See below. |
| Gmail | $0 | – | Your own account. |

**Typical totals:** $0/month with free tiers and no AI; the AI cost of the emails you draft on top; about $50–75/month with Hunter Starter and Vercel Pro.

## How spending is controlled

Set in Kontakty → Odkrywanie → *Ustawienia przebiegu* and Ustawienia → Integracje.

| Control | Default | What it does |
|---|---|---|
| Daily limit (USD) | $1 | Automatic paid work (Hunter, Tavily, automatic AI reading) stops for the day when reached. |
| Monthly limit (USD) | $20 | The same for the calendar month (Warsaw time). |
| Monthly Hunter credits | 50 | Matches the Free plan. Raise it after upgrading. |
| Monthly Tavily credits | 1,000 | Matches the free plan. |
| Hunter results per domain search | 3 | Each returned email costs 1 credit, so this caps a search at 3 credits. |
| Paid enrichments per run | 10 | Domain searches plus email look-ups per daily run. |
| Hunter found-only mode | on | Email finder returns only addresses seen on public pages; never guessed ones. |
| Automatic AI page reading | off | When on, each researched company may use one AI call, reserved against the limits first. |

How it works: before each paid call the app **reserves** its maximum cost, under a database lock so parallel workers cannot overspend. After the call it records the real cost, or releases the reservation if the call failed or the provider did not charge. When a limit is reached, the run continues with free work (crawling public pages) and ends with the status *Limit wydatków* so you can see why.

USD amounts for credits are estimates: Hunter credit = $0.0245 (Starter price ÷ credits), Tavily credit = $0.008.

## AI costs

- **Email drafting, rewrites and document summaries** run only when you click. They are recorded in Aktywność with the number of tokens and an estimated cost, and they never use up the automatic limits.
- **Automatic AI page reading** (off by default) is the only AI use without a click. It is budgeted like Hunter.
- The estimate uses *Szacowany koszt AI (USD za mln tokenów)*, default $25 per million tokens. **This number is an assumption, not a quoted price.** Look up the price of your model at [anthropic.com/pricing](https://www.anthropic.com/pricing) and set it. Input and output tokens are priced differently; one blended number is a simplification.
- To lower AI cost, set `AI_MODEL` to a cheaper model and compare the drafts.

## Not included

A custom domain, VAT on foreign services (a Polish business may need to self-assess reverse-charge VAT; not researched), Google Workspace if you prefer it to a personal Gmail account, and any paid email verification beyond Hunter.
