import { safeEqual } from "@/server/crypto";
import { env } from "@/server/env";
import { api, HttpError } from "@/server/http";
import { runTick } from "@/server/jobs/tick";

export const maxDuration = 300;

/**
 * Called by the scheduler: Vercel Cron (GET, 24 daily entries = hourly, see vercel.json), Cloud Scheduler,
 * cron-job.org or any cron (POST). Authenticated with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends
 * this header automatically when CRON_SECRET is set). Idempotent: duplicate or missed invocations are safe.
 * The time budget comes from TICK_BUDGET_SECONDS (default 270, below Vercel Hobby's 300 s limit).
 */
const tick = api(
  async (req) => {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || !safeEqual(token, env().CRON_SECRET)) throw new HttpError(401, "unauthorized");
    const budget = Math.min(Number(process.env.TICK_BUDGET_SECONDS ?? 270), 3000) * 1000;
    const report = await runTick({ budgetMs: budget, trigger: "http" });
    return report;
  },
  { public: true },
);

export const GET = tick;
export const POST = tick;
