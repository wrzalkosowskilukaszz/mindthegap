# Hosting for a commercial single-user app (research)

- **Date of research:** 2026-10-15. Every source was accessed on 2026-10-15. The IDs in square brackets, for example [H4], point to the source list at the end.
- **Workload:**
  - a Next.js/TypeScript web app used by one person, for business (so **commercial use**);
  - PostgreSQL;
  - an hourly server-side tick (reply sync, queued sends);
  - a daily discovery job of about 10–20 minutes at **07:00 Europe/Warsaw**, DST-correct, running while the owner's computer is off.
- **How to read this document:**
  - **Official** means stated by the provider. Text in quotation marks is verbatim.
  - **Inference** means my own conclusion or arithmetic.
  - All prices are in USD, excluding VAT, as published on the date above.

---

## 0. Bottom line

- **Free tiers and commercial use:**
  - **Vercel Hobby is not allowed for this app.** "Hobby teams are restricted to non-commercial personal use only" [H1].
  - **Render's** free instances are not for production [H36].
  - **Fly.io** has no free tier [H32].
  - **Google Cloud's** Free Tier and **Neon's** Free plan carry no non-commercial restriction in the documents I read [H18][H24][H28].
- **GitHub Actions should not run the discovery job.** GitHub's terms say GitHub-hosted runners must not be used for "any other activity unrelated to the production, testing, deployment, or publication of the software project", and not "as part of a serverless application" [H31].
- **Recommended:**
  - Google Cloud Run: a service for the web app and a job for discovery.
  - Cloud Scheduler: an hourly tick, plus a daily job with `timeZone: "Europe/Warsaw"`.
  - Neon Postgres in Frankfurt.
  - Expected cost: **about $0 fixed + about $2–6/month usage** (section 7). It needs a Google Cloud billing account with a payment method [H18].
- **Runner-up:** Vercel Pro ($20/month fixed) + Neon. Vercel cron is UTC-only [H7], so 07:00 Warsaw needs a DST guard in code. A 20-minute job needs the 30-minute "extended max duration" beta, or chunking [H4].

---

## 1. Vercel

### Commercial use (official [H1], page "Last updated September 14, 2026")
> "Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan."
>
> "Commercial usage is defined as any Deployment that is used for the purpose of financial gain of anyone involved in any part of the production of the project, including a paid employee or consultant writing the code."

The listed examples include "Advertising the sale of a product or service". The Hobby plan page repeats: "the Hobby plan restricts users to non-commercial, personal use only" [H9]. The pricing FAQ says: "Our Hobby plan is for personal, non-commercial use." [H2]

**Inference:** an app that runs the outreach of a paid training business is commercial usage, so Hobby is excluded.

### Pro price (official [H3], [H2])
- "$20/month Pro platform fee", with "1 deploying team seat included" and "$20/month in usage credit".
- Additional deploying seats cost $20/month. Viewer seats are free.
- "you can pay as you go, uncapped" above the credit. "All new teams have a default on-demand usage budget of $200 (which can be customized)" [H2].

### Function maximum duration (official [H4], "Last updated August 24, 2026"), with fluid compute enabled by default

| Plan | Default | Maximum | Extended maximum |
|---|---|---|---|
| Hobby | 300 s | 300 s | – |
| Pro | 300 s | 800 s | 1,800 s (30 min) |
| Enterprise | 300 s | 800 s | 1,800 s (30 min) |

- "The 800 second maximum is generally available for Pro and Enterprise teams."
- Extended max duration is **Beta**: "durations above 800 seconds must be configured for each function in code or in vercel.json." It is supported on `nodejs22.x`/`nodejs24.x`, among other runtimes.

### Request body size (official [H5])
"The maximum payload size for the request body or the response body of a Vercel Function is 4.5 MB." Above that, the function returns `413: FUNCTION_PAYLOAD_TOO_LARGE`.

**Inference:** uploading email attachments through a function caps at 4.5 MB per request, unless the app uploads directly to storage.

### Cron jobs (official [H6] "Last updated July 15, 2026", [H7], [H8])

| Plan | Cron jobs per project | Minimum interval | Scheduling precision |
|---|---|---|---|
| Hobby | 100 | Once per day | Per-hour (±59 min) |
| Pro | 100 | Once per minute | Per-minute |
| Enterprise | 100 | Once per minute | Per-minute |

- Hobby: "a cron job configured as 0 1 * * * (every day at 1 am) will trigger anywhere between 1:00 am and 1:59 am."
- "**The timezone is always UTC**" [H7].
- Delivery [H8]:
  - "Vercel will not retry an invocation if a cron job fails."
  - "Cron job delivery is best effort."
  - Cron "can also occasionally invoke the same scheduled run more than once. Because of this, cron jobs should be resilient to both missed runs and duplicate runs."
  - "The duration limits for Cron jobs are identical to those of Vercel Functions."
- Cron jobs are "included in all plans". Executions are billed as function usage [H6].

**Inference, 07:00 Warsaw on Vercel:**
- Schedule `0 5,6 * * *` (UTC). In code, run only when the Europe/Warsaw local hour is 7, and record the run per local date. In summer (CEST, UTC+2) that is the 05:00 UTC run; in winter (CET, UTC+1) the 06:00 UTC run.
- A 20-minute discovery run exceeds the 800 s GA limit. Either opt into the 1,800 s beta for that function, or split the work into chunks under 800 s that resume from a cursor.

---

## 2. Google Cloud Run and Cloud Scheduler

### Billing account and free tier (official [H18], page "Last updated 2026-10-13 UTC")
- "A Google Cloud billing account is required to access the Google Cloud Free Tier."
- New accounts get a Free Trial with "$300 in free Welcome credit which is valid for 90 days". Signup requires "a credit card or other payment method".
- After the trial, "If you don't upgrade to a Paid billing account before 90 days pass … your Free Trial billing account will be closed and all of its associated projects and resources will be stopped."
- Cloud Run Free Tier (request-based billing): "2 million requests per month", "360,000 GB-seconds of memory, 180,000 vCPU-seconds of compute time" [H18].
- Also in the Free Tier [H18]:
  - Cloud Build: "2,500 build-minutes per month for machine type e2-standard-2";
  - Artifact Registry: "0.5 GB of storage per month";
  - Secret Manager: "6 active secret versions per month" and "10,000 access operations per month".
- **Inference:** I found no non-commercial restriction on the Google Cloud Free Tier. It is offered on a general business platform.

### Cloud Run pricing (official [H10])
- "The free tier usage is aggregated across projects by billing account and resets every month … The free tier is applied as a spending based discount using Tier 1 pricing."
- Free tier by billing configuration (based on us-central1 prices):
  - **Services, request-based billing:** 180,000 vCPU-seconds, 360,000 GiB-seconds and 2 million requests per month.
  - **Services, instance-based billing:** 240,000 vCPU-seconds and 450,000 GiB-seconds.
  - **Jobs:** 240,000 vCPU-seconds and 450,000 GiB-seconds.
- Tier 1 (us-central1) list prices:
  - request-based services: $0.000024 per vCPU-second (active), $0.0000025 per GiB-second, $0.40 per million requests;
  - jobs and instance-based services: $0.000018 per vCPU-second and $0.000002 per GiB-second.
- **europe-central2 (Warsaw)** and **europe-west3 (Frankfurt)** are both listed as "Subject to Tier 2 pricing" [H10].
  - **Not captured:** the exact Tier 2 numbers. The page loads them dynamically. Check them in the pricing calculator.
- Spend caps [H12]: "When you hit a spend cap, Google Cloud pauses all Cloud Run workloads to prevent further costs".

### Request timeout (official [H11])
"The timeout is set by default to 5 minutes (300 seconds) and can be extended up to 60 minutes (3600 seconds)." For timeouts above 15 minutes, Google recommends implementing retries and idempotent handlers.

### CPU allocation after the response (official [H12])
- "Request-based billing (default): Cloud Run instances are only charged when they process requests, when they start, and when they shut down." With it, "CPU is only allocated during request processing."
- "Instance-based billing: Cloud Run instances are charged for the entire lifecycle of instances … CPU is allocated for the entire container instance lifecycle."
- "Unlike Cloud Run services, all Cloud Run jobs have instance-based billing."
- **Inference:** with the default billing, do not start work after sending the HTTP response (no fire-and-forget). Finish the work inside the request, or use a job.

### Minimum instances 0 and cold starts (official [H13])
- "By default, container instances have min-instances turned off, with a setting of 0."
- Minimum instances exist to "avoid slow container start times and reduce service latency … especially when scaling from zero active instances".
- With request-based billing, idle minimum instances are billed at the idle rate [H10].
- **Inference:** at min-instances 0, the first request after idle pays a container cold start. Google gives no figure. For one user this is acceptable.

### Cloud Run Jobs (official [H14], [H17])
- "By default, each task runs for a maximum of 10 minutes: you can change this to a shorter time or a longer time up to 168 hours (7 days)."
- "If your job has retries enabled, the timeout setting applies to each attempt of a task."
- Scheduling: Cloud Scheduler calls `https://run.googleapis.com/v2/projects/PROJECT_ID/locations/CLOUD_RUN_REGION/jobs/JOB:run` with `--oauth-service-account-email` [H17]. The Scheduler region "does not need to match the region used for the Cloud Run job".

### Request size (official [H16])
"Maximum HTTP/1 request size: 32 MiB per request", with no limit when using an HTTP/2 server.

### Cloud Scheduler
- **Pricing (official [H19]):**
  - "A job is billed $0.10/job/31 days".
  - "Each Google billing account gets 3 jobs per month free. Note that the free tier is measured at the account level not the project level."
  - "A job is not billed for individual executions." "A paused job is counted as a job."
- **Time zones and DST (official [H20], [H21]):**
  - "The value of this field must be the time zone abbreviation used in the tz database. The default time zone is UTC."
  - Field `timeZone`: "The rules for daylight saving time are determined by the chosen tz."
  - "For some time zones, daylight saving time can cause jobs to run or not run unexpectedly. This is because Cloud Scheduler runs on wall clock time. In instances where a time can occur twice (such as the case when clocks go backwards) and your job is scheduled at this time, your scheduled job might observe execution anomalies."
- **DST in the EU (official [H37]):** summer time begins and ends "at 1.00 a.m., Greenwich Mean Time", on the last Sunday in March and the last Sunday in October.
  - **Inference:** in Warsaw the clock jumps from 02:00 to 03:00, or from 03:00 back to 02:00. A job at **07:00 Europe/Warsaw is never inside an ambiguous or skipped hour**. Using `timeZone: "Europe/Warsaw"` with `0 7 * * *` gives a DST-correct 07:00 run.
- **Attempt deadline (official [H21]):** "For HTTP targets, the default is 3 minutes. The deadline must be in the interval [15 seconds, 30 minutes]." If the handler does not respond in time, the attempt is marked `DEADLINE_EXCEEDED` and retried according to the RetryConfig.
  - **Inference:** run the 10–20 minute discovery as a **Cloud Run Job**. The Scheduler call only starts the execution, so the job is not bound to the 30-minute HTTP deadline.
- **OIDC authentication to Cloud Run (official [H22]):**
  - Scheduler "creates a header token based on your client service account … You can use either an ID (OIDC) token or an OAuth (access) token. OIDC is generally used except for Google APIs hosted on *.googleapis.com as these APIs expect an OAuth token."
  - For Cloud Run "you must grant the Cloud Run Invoker (roles/run.invoker) role".
  - The audience is "typically, the job's target URL without any URL parameters".
  - **Inference:** use OIDC for the tick endpoint on the web service, and OAuth for `jobs/…:run` on `run.googleapis.com`.
- **Region availability (official):** `europe-central2` (Warsaw, Poland) is listed for Cloud Run [H15] and for Cloud Scheduler [H23].

---

## 3. Neon Postgres

### Free plan limits (official [H24], [H25])
- **Projects:** 100.
- **Compute:** "100 CU-hours/project". Neon explains: "enough to run a 0.25 CU compute in a project for 400 hours/month".
- **Scale to zero:** "After 5 min". On Free "this setting is fixed" [H27]. On reconnect, the database "reactivates automatically within a few hundred milliseconds" [H27].
- **Storage:** "1 GB/project, 20 GB account total".
- **Public network transfer:** "5 GB per project included".
- **Instant restore (PITR) history:** "6 hours, up to 1 GB-month"; "Free: No charge, 6-hour limit, capped at 1 GB of change history".
- **Snapshots:** "Free: 1 manual snapshot". "scheduled backups are not available on the Free plan".
- **Metrics retention:** 1 day.

### Paid plans (official [H24])
- **Launch:** "Pay for what you use", with "no minimum monthly fee" and "Invoices under $0.50 are not collected".
  - Compute: $0.106 per CU-hour. Storage: $0.35 per GB-month.
  - Scale to zero: "After 5 min, can be disabled".
  - Instant-restore history "Up to 7 days, billed at $0.20/GB-month". Snapshots: 100 manual, plus scheduled backups.
- **Scale:** $0.222 per CU-hour, history up to 30 days, and an SLA (the SLA is "exclusively" for Scale [H28]).

### Commercial use (inference)
- Neon's product schedule and plans page contain no non-commercial restriction for the Free plan [H24][H28].
- The pricing FAQ describes Free as for "Prototypes, side projects, and small teams". It also says: "If your usage fits comfortably within the Free plan and you're not running a production workload, there's no reason to upgrade" [H25]. That is guidance, not a ban.
- **Inference:** Free is permitted for commercial use. The 6-hour restore window and single manual snapshot are thin protection for business records. Launch is the sensible minimum.

### EU regions (official [H26])
- "AWS Europe (Frankfurt) — aws-eu-central-1" and "AWS Europe (London) — aws-eu-west-2".
- "You cannot change the region for an existing project."
- Neon Azure regions are deprecated. "Projects on the Free plan that have been inactive for 90 days or more are subject to deletion as of October 5, 2026" (Azure context).
- **Inference:** use `aws-eu-central-1` for EU data residency.

---

## 4. GitHub Actions scheduled workflows

**Official [H29]:**
- "By default, scheduled workflows run in UTC. You can optionally specify a timezone using an IANA timezone string". For DST spring-forward, "scheduled workflows in skipped hours advance to the next valid time".
- "The shortest interval you can run scheduled workflows is once every 5 minutes."
- "The schedule event can be delayed during periods of high loads of GitHub Actions workflow runs. High load times include the start of every hour. If the load is sufficiently high enough, some queued jobs may be dropped."
- "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days."
- Schedules run only on the default branch.

**Free minutes (official [H30]):**
- "GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners."
- Private repositories: GitHub Free 2,000 minutes per month, GitHub Pro 3,000. Linux overage is $0.006 per minute.

**Terms (official [H31]):** Actions should not be used for:
- "Any activity that places a burden on our servers, where that burden is disproportionate to the benefits provided to users (for example, don't use Actions as a content delivery network or as part of a serverless application, but a low benefit Action could be ok if it's also low burden)";
- "If using GitHub-hosted runners, any other activity unrelated to the production, testing, deployment, or publication of the software project associated with the repository where GitHub Actions are used."

**Inference:**
- Running the business discovery job on GitHub-hosted runners does not fit these terms.
- Separately, a public repository's schedule disappears after 60 quiet days, and the top of the hour is delayed or dropped.
- Use GitHub Actions for CI only. A cron "pinger" that calls the app is a grey area under "part of a serverless application". Do not depend on it.

---

## 5. Alternatives in brief

| Provider | Small always-on Node app (official) | Free tier? (official) | Commercial use / notes |
|---|---|---|---|
| **Fly.io** [H32] | shared-cpu-1x: 256 MB $2.19/month; 512 MB $3.69/month; 1 GB $6.70/month (Ashburn prices; Frankfurt is higher, e.g. 1 GB $7.73). Managed Postgres from $38/month. | "No. New organizations don't have a free tier or a monthly free usage allowance." The trial is "up to 2 hours of Machine runtime or 7 days". | Paid only, so commercial use is fine. **Inference:** about $4–8 with Neon instead of Fly Postgres. |
| **Railway** [H33] | Hobby "$5 / month" including "$5 of resource usage". RAM "$10 / GB / month", CPU "$20 / vCPU / month". Pro "$20 / month". | "Free … with $1 of free credit per month". A trial gives a one-time $5. | Hobby is "for indie hackers and developers to build and deploy personal projects". I found no explicit commercial ban, but Pro is positioned for production. The AUP bans sending "unsolicited bulk messages" [H34]. That does not cover 1:1 emails, but note it. **Inference:** 512 MB always-on is about $5–7/month on Hobby. |
| **Render** [H35][H36] | Web service: "Less than 1 CPU $7/month 512 MB". Postgres from $6/month. Cron jobs "$0.00016/minute" (<1 CPU). Workspace: Hobby $0 "For individuals building personal projects and prototypes", Pro "$25/mo" "For teams deploying production-grade apps". | Free web services "spin down" after "15 minutes without receiving any inbound traffic", 750 instance-hours per month. "Free Render Postgres databases expire 30 days after creation." "Do not use them for production applications." | Free is not for production. **Inference:** about $13+/month for web + DB on Hobby, or $25 + compute on Pro. |

---

## 6. Recommended deployment architecture (inference)

**Region:** Neon `aws-eu-central-1` (Frankfurt) [H26]. Run Cloud Run and Cloud Scheduler in `europe-west3` (Frankfurt) to sit near the database.
- `europe-central2` (Warsaw) is also available [H15][H23]. It is in the same price tier [H10], but it is further from the Neon region.
- Data stays in the EU in both cases.

1. **Web app: Cloud Run service `web`.**
   - The Next.js standalone build in a container.
   - Request-based billing (default), min-instances 0, max-instances 2, request timeout 300 s.
   - The owner signs in with Google (`openid email`). The app allows exactly one email address.
   - OAuth refresh tokens are stored encrypted. The key is in Secret Manager.
2. **Hourly tick: Cloud Scheduler job `tick-hourly`.**
   - `0 * * * *`, `timeZone: "Etc/UTC"`. An hourly tick does not need local time, and UTC avoids the duplicate hour.
   - HTTP POST to `web` at `/api/internal/tick`, with an **OIDC token** from a dedicated service account that has `roles/run.invoker`.
   - The endpoint verifies the token's issuer, audience and service-account email. Because the web service also accepts browser traffic, Cloud Run IAM alone cannot protect this path.
   - The work must finish well inside the attempt deadline (set it to 5–10 min; the maximum is 30 min) [H21].
   - Work: Gmail `history.list` reply sync, sending due queued messages, and a "catch-up" check that starts discovery if today's 07:00 run is missing.
3. **Daily discovery: Cloud Run job `discovery` + Cloud Scheduler job `discovery-daily`.**
   - Schedule `0 7 * * *`, `timeZone: "Europe/Warsaw"`. This is DST-correct, as explained in section 2.
   - The target is `run.googleapis.com/v2/…/jobs/discovery:run` with an **OAuth token** [H17][H22].
   - Job settings: task timeout 45 min (the maximum is 168 h [H14]), 1 task, max retries 1.
4. **Idempotency (needed on every platform, since triggers can be missed or duplicated [H8][H20]):**
   - a `job_runs` table with a unique key `(job_name, local_date)` for daily jobs;
   - a Postgres advisory lock per job;
   - "process everything outstanding since the last success" logic.
5. **Safety:** a Cloud Billing budget alert, plus a Cloud Run spend cap [H12]. Neon spending notifications are available on Launch and Scale [H24].
6. **Database:** Neon **Launch** (7-day instant restore, scheduled backups) [H24]. The Free plan works technically if cost must be zero, but with 6-hour PITR.

This uses 2 Scheduler jobs, inside the 3 free jobs per billing account [H19]. It leaves one free job for a later Gmail `watch` renewal if push sync is ever added.

---

## 7. Monthly cost estimate (inference; arithmetic on the official prices above)

**Assumptions:**
- The owner uses the app for about 1 h/day.
- The tick runs 24 times a day at about 10 s each.
- Discovery runs 20 min/day on 1 vCPU / 1 GiB.
- The web container has 1 vCPU / 512 MiB.
- The Neon compute is 0.25 CU and wakes for each tick, staying up at least 5 minutes each time. That is about 3.5 compute-hours a day in total.
- Data stays under 1 GB.

### Recommended: Cloud Run + Cloud Scheduler + Neon

| Item | Fixed | Usage (estimate) | Basis |
|---|---|---|---|
| Cloud Run service (web + ticks) | $0 | Well under 30,000 vCPU-s and 15,000 GiB-s per month, inside the 180,000 / 360,000 free tier → **$0** | [H10][H18] |
| Cloud Run job (discovery, 20 min/day) | $0 | About 36,000 vCPU-s and 36,000 GiB-s per month, inside the 240,000 / 450,000 jobs free tier → **$0**. At Tier 1 list price it would be about $0.72; Tier 2 is somewhat higher (not captured). | [H10] |
| Cloud Scheduler (2 jobs) | $0 | 3 free jobs per billing account | [H19] |
| Cloud Build / Artifact Registry / Secret Manager | $0 | Within 2,500 build-min, 0.5 GB and 6 secret versions if old images are cleaned up. Otherwise cents (prices not checked). | [H18] |
| Network egress (GCP → Neon on AWS, Gmail API) | – | Not priced in this research. Expected well under 1 GB/month, so cents. | – |
| Neon Launch | $0 (no minimum) | Compute: about 105 h × 0.25 CU ≈ 26 CU-h × $0.106 ≈ **$2.8**. Storage: 0.5 GB × $0.35 ≈ $0.2. PITR history: about $0.05. **≈ $3** | [H24] |
| **Total** | **$0** | **≈ $2–6 / month** (≈ $0–1 if Neon Free is used) | |

### Alternative: Vercel Pro + Neon

| Item | Fixed | Usage | Basis |
|---|---|---|---|
| Vercel Pro | $20/month (includes $20 credit and 1 seat) | Likely inside the credit at this volume | [H3] |
| Neon Launch | $0 | ≈ $3 | [H24] |
| **Total** | **$20** | **≈ $20–25 / month** | |

Constraints on Vercel: cron is UTC-only, so the DST guard from section 1 is needed. A run longer than 800 s needs the 1,800 s beta [H4][H7].

### Other options (inference)
- **Fly.io:** about $4–5 for a 512 MB machine in Frankfurt, plus Neon $0–3. A scheduler is still needed: in-process cron, or Cloud Scheduler calling the app. Total about $5–8.
- **Railway Hobby:** $5 minimum, which includes $5 of usage. 512 MB always-on is about $5 of RAM plus CPU usage. With Neon, about $6–10.
- **Render:** Starter $7 + Postgres $6+ + cron about $0.10. About $13–15 on a Hobby workspace. The Pro workspace adds $25.

**Not included anywhere:** a custom domain, VAT (a Polish business buying from non-Polish providers may need to self-assess reverse-charge VAT; not researched), and Google Workspace if chosen for Gmail.

---

## Sources (all accessed 2026-10-15)

- [H1] Vercel, "Fair use Guidelines" (Last updated September 14, 2026) — https://vercel.com/docs/limits/fair-use-guidelines — accessed 2026-10-15
- [H2] Vercel, "Pricing" — https://vercel.com/pricing — accessed 2026-10-15
- [H3] Vercel, "Vercel Pro Plan" — https://vercel.com/docs/plans/pro-plan — accessed 2026-10-15
- [H4] Vercel, "Configuring Maximum Duration for Vercel Functions" (Last updated August 24, 2026) — https://vercel.com/docs/functions/configuring-functions/duration — accessed 2026-10-15
- [H5] Vercel, "Vercel Functions Limits" (request body size) — https://vercel.com/docs/functions/limitations — accessed 2026-10-15
- [H6] Vercel, "Usage & Pricing for Cron Jobs" (Last updated July 15, 2026) — https://vercel.com/docs/cron-jobs/usage-and-pricing — accessed 2026-10-15
- [H7] Vercel, "Cron Jobs" (cron expression limitations, UTC) — https://vercel.com/docs/cron-jobs — accessed 2026-10-15
- [H8] Vercel, "Managing Cron Jobs" (Last updated August 11, 2026) — https://vercel.com/docs/cron-jobs/manage-cron-jobs — accessed 2026-10-15
- [H9] Vercel, "Vercel Hobby Plan" (Last updated September 14, 2026) — https://vercel.com/docs/plans/hobby — accessed 2026-10-15
- [H10] Google Cloud, "Cloud Run pricing" — https://cloud.google.com/run/pricing — accessed 2026-10-15
- [H11] Google Cloud, "Configure request timeout for services" (Cloud Run) — https://cloud.google.com/run/docs/configuring/request-timeout — accessed 2026-10-15
- [H12] Google Cloud, "Billing settings for services" (Cloud Run) — https://cloud.google.com/run/docs/configuring/billing-settings — accessed 2026-10-15
- [H13] Google Cloud, "Set minimum instances for services" (Cloud Run) — https://cloud.google.com/run/docs/configuring/min-instances — accessed 2026-10-15
- [H14] Google Cloud, "Configure task timeout for jobs" (Cloud Run) — https://cloud.google.com/run/docs/configuring/task-timeout — accessed 2026-10-15
- [H15] Google Cloud, "Cloud Run locations" — https://cloud.google.com/run/docs/locations — accessed 2026-10-15
- [H16] Google Cloud, "Cloud Run quotas and limits" — https://cloud.google.com/run/quotas — accessed 2026-10-15
- [H17] Google Cloud, "Execute jobs on a schedule" (Cloud Run) — https://cloud.google.com/run/docs/execute/jobs-on-schedule — accessed 2026-10-15
- [H18] Google Cloud, "Free Google Cloud features and trial offer" (Last updated 2026-10-13 UTC) — https://cloud.google.com/free/docs/free-cloud-features — accessed 2026-10-15
- [H19] Google Cloud, "Cloud Scheduler pricing" — https://cloud.google.com/scheduler/pricing — accessed 2026-10-15
- [H20] Google Cloud, "Cron job format and time zone" (Cloud Scheduler) — https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules — accessed 2026-10-15
- [H21] Google Cloud, Cloud Scheduler REST reference "projects.locations.jobs" (attemptDeadline, timeZone) — https://cloud.google.com/scheduler/docs/reference/rest/v1/projects.locations.jobs — accessed 2026-10-15
- [H22] Google Cloud, "Use authentication with HTTP targets" (Cloud Scheduler) — https://cloud.google.com/scheduler/docs/http-target-auth — accessed 2026-10-15
- [H23] Google Cloud, "Cloud Scheduler locations" — https://cloud.google.com/scheduler/docs/locations — accessed 2026-10-15
- [H24] Neon, "Neon plans" — https://neon.com/docs/introduction/plans — accessed 2026-10-15
- [H25] Neon, "Pricing" (including FAQ) — https://neon.com/pricing — accessed 2026-10-15
- [H26] Neon, "Regions" — https://neon.com/docs/introduction/regions — accessed 2026-10-15
- [H27] Neon, "Scale to zero" — https://neon.com/docs/introduction/scale-to-zero — accessed 2026-10-15
- [H28] Neon / Databricks, "Product Specific Schedule (Neon)" (Last Updated August 5, 2026) — https://neon.com/terms-of-service — accessed 2026-10-15
- [H29] GitHub Docs, "Events that trigger workflows" (schedule) — https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows — accessed 2026-10-15
- [H30] GitHub Docs, "GitHub Actions billing" — https://docs.github.com/en/billing/concepts/product-billing/github-actions — accessed 2026-10-15
- [H31] GitHub Docs, "GitHub Terms for Additional Products and Features" (Actions) — https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features — accessed 2026-10-15
- [H32] Fly.io, "Pricing" — https://fly.io/docs/about/pricing/ — accessed 2026-10-15
- [H33] Railway, "Pricing Plans" — https://docs.railway.com/reference/pricing/plans — accessed 2026-10-15
- [H34] Railway, "Acceptable Use Policy" — https://railway.com/legal/fair-use — accessed 2026-10-15
- [H35] Render, "Pricing" — https://render.com/pricing — accessed 2026-10-15
- [H36] Render, "Deploy for Free" — https://render.com/docs/free — accessed 2026-10-15
- [H37] Directive 2000/84/EC on summer-time arrangements, Articles 2–3 — https://publications.europa.eu/resource/celex/32000L0084 (EUR-Lex: https://eur-lex.europa.eu/eli/dir/2000/84/oj) — accessed 2026-10-15
