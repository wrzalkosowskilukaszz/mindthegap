/** Everything the Kontakty › Odkrywanie screen shows. */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { nextScheduledInstant } from "@/lib/time";
import { db } from "../db/client.ts";
import { appEvents, jobRuns, jobTasks, settings } from "../db/schema.ts";
import { integrations } from "../env.ts";
import { spendSummary } from "../jobs/budget.ts";
import { getSettings } from "../settings.ts";
import { coverage } from "./companies.ts";

export async function discoveryStatus() {
  const [sched, disc, fresh] = await Promise.all([getSettings("scheduler"), getSettings("discovery"), getSettings("freshness")]);
  const runs = await db().select().from(jobRuns).where(eq(jobRuns.kind, "discovery")).orderBy(desc(jobRuns.createdAt)).limit(25);
  const active = runs.find((r) => r.status === "queued" || r.status === "running") ?? null;
  let activeProgress: { done: number; total: number; failed: number } | null = null;
  if (active) {
    const [p] = await db()
      .select({
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${jobTasks.status} in ('done','skipped','failed'))::int`,
        failed: sql<number>`count(*) filter (where ${jobTasks.status} = 'failed')::int`,
      })
      .from(jobTasks)
      .where(eq(jobTasks.runId, active.id));
    activeProgress = p ?? null;
  }
  const lastOk = runs.find((r) => ["succeeded", "partial", "budget_exhausted"].includes(r.status) && r.finishedAt);
  const [tick] = await db().select().from(settings).where(eq(settings.key, "tick_state")).limit(1);
  const tickState = (tick?.value ?? null) as { lastTickAt?: string } | null;
  const issues = await db()
    .select()
    .from(appEvents)
    .where(and(isNull(appEvents.resolvedAt), sql`${appEvents.level} in ('warning','error')`, sql`${appEvents.category} in ('discovery','provider','scheduler','ai')`))
    .orderBy(desc(appEvents.createdAt))
    .limit(20);
  return {
    integrations: integrations(),
    scheduler: {
      ...sched,
      nextRunAt: sched.enabled ? nextScheduledInstant(new Date(), sched.localTime, sched.timezone).toISOString() : null,
      lastTickAt: tickState?.lastTickAt ?? null,
    },
    discovery: disc,
    freshness: fresh,
    runs: runs.map((r) => ({
      id: r.id,
      trigger: r.trigger,
      localDate: r.localDate,
      status: r.status,
      stats: r.stats,
      plan: r.plan,
      costUsd: r.costMicros / 1e6,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
      startedAt: r.startedAt?.toISOString() ?? null,
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
    active: active ? { id: active.id, status: active.status, progress: activeProgress } : null,
    lastSuccessfulRunAt: lastOk?.finishedAt?.toISOString() ?? null,
    spend: await spendSummary(),
    coverage: await coverage(),
    issues: issues.map((i) => ({ id: i.id, level: i.level, category: i.category, message: i.message, createdAt: i.createdAt.toISOString(), runId: i.runId })),
  };
}

export type DiscoveryStatus = Awaited<ReturnType<typeof discoveryStatus>>;
