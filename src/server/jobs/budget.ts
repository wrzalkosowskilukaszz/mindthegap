/**
 * Spending controls for paid provider calls: reserve before calling, then commit or release.
 * Limits: daily and monthly USD (Europe/Warsaw calendar), and monthly credits per provider.
 * Reservation happens under a transaction-scoped advisory lock, so concurrent workers can't overspend.
 */
import { and, eq, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "../db/client.ts";
import { providerUsage } from "../db/schema.ts";
import { getSettings } from "../settings.ts";

export class BudgetExceededError extends Error {
  constructor(
    public scope: "daily" | "monthly" | "credits",
    message: string,
  ) {
    super(message);
  }
}

/** USD per provider credit (operational estimate; set in Ustawienia › Odkrywanie). */
/** Hunter Starter: $49 / 2,000 credits; Tavily PAYG: $0.008 per credit (docs/research/PROVIDERS.md). */
export const DEFAULT_USD_PER_CREDIT: Record<string, number> = { hunter: 0.0245, tavily: 0.008 };

/** ISO strings: raw SQL fragments need string parameters (the driver doesn't serialise Date there). */
function periodStarts(zone = "Europe/Warsaw") {
  const now = DateTime.now().setZone(zone);
  return { day: now.startOf("day").toUTC().toISO()!, month: now.startOf("month").toUTC().toISO()! };
}

export async function spendSummary() {
  const { day, month } = periodStarts();
  const rows = await db()
    .select({
      provider: providerUsage.provider,
      dayMicros: sql<number>`coalesce(sum(${providerUsage.costMicros}) filter (where ${providerUsage.createdAt} >= ${day}::timestamptz), 0)::bigint`,
      monthMicros: sql<number>`coalesce(sum(${providerUsage.costMicros}), 0)::bigint`,
      monthCredits: sql<number>`coalesce(sum(${providerUsage.credits}), 0)::float8`,
    })
    .from(providerUsage)
    .where(
      and(
        sql`${providerUsage.createdAt} >= ${month}::timestamptz`,
        sql`${providerUsage.status} in ('reserved','committed')`,
      ),
    )
    .groupBy(providerUsage.provider);
  const total = rows.reduce(
    (a, r) => ({ day: a.day + Number(r.dayMicros), month: a.month + Number(r.monthMicros) }),
    { day: 0, month: 0 },
  );
  return {
    dayUsd: total.day / 1e6,
    monthUsd: total.month / 1e6,
    byProvider: Object.fromEntries(
      rows.map((r) => [
        r.provider,
        {
          monthCredits: Number(r.monthCredits),
          monthUsd: Number(r.monthMicros) / 1e6,
          dayUsd: Number(r.dayMicros) / 1e6,
        },
      ]),
    ),
  };
}

export async function reserve(opts: {
  provider: string;
  operation: string;
  credits: number;
  runId?: string | null;
  taskId?: string | null;
  detail?: string;
}): Promise<string> {
  const settings = await getSettings("discovery");
  const usdPerCredit = DEFAULT_USD_PER_CREDIT[opts.provider] ?? 0;
  const costMicros = Math.round(opts.credits * usdPerCredit * 1e6);
  const { day, month } = periodStarts();
  return db().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('mtg-budget'))`);
    const [agg] = await tx
      .select({
        day: sql<number>`coalesce(sum(${providerUsage.costMicros}) filter (where ${providerUsage.createdAt} >= ${day}::timestamptz), 0)::bigint`,
        month: sql<number>`coalesce(sum(${providerUsage.costMicros}), 0)::bigint`,
        credits: sql<number>`coalesce(sum(${providerUsage.credits}) filter (where ${providerUsage.provider} = ${opts.provider}), 0)::float8`,
      })
      .from(providerUsage)
      .where(
        and(
          sql`${providerUsage.createdAt} >= ${month}::timestamptz`,
          sql`${providerUsage.status} in ('reserved','committed')`,
        ),
      );
    const dayMicros = Number(agg?.day ?? 0);
    const monthMicros = Number(agg?.month ?? 0);
    const credits = Number(agg?.credits ?? 0);
    const creditCap = settings.monthlyProviderCredits[opts.provider];
    if (creditCap !== undefined && credits + opts.credits > creditCap) {
      throw new BudgetExceededError(
        "credits",
        `Limit kredytów ${opts.provider} na miesiąc (${creditCap}) wyczerpany`,
      );
    }
    if (dayMicros + costMicros > settings.dailySpendLimitUsd * 1e6) {
      throw new BudgetExceededError(
        "daily",
        `Dzienny limit wydatków ($${settings.dailySpendLimitUsd}) osiągnięty`,
      );
    }
    if (monthMicros + costMicros > settings.monthlySpendLimitUsd * 1e6) {
      throw new BudgetExceededError(
        "monthly",
        `Miesięczny limit wydatków ($${settings.monthlySpendLimitUsd}) osiągnięty`,
      );
    }
    const [row] = await tx
      .insert(providerUsage)
      .values({
        provider: opts.provider,
        operation: opts.operation,
        credits: opts.credits,
        costMicros,
        status: "reserved",
        runId: opts.runId ?? null,
        taskId: opts.taskId ?? null,
        detail: opts.detail ?? null,
      })
      .returning({ id: providerUsage.id });
    return row!.id;
  });
}

/** Record the actual units used (may be 0 when a provider didn't charge). */
export async function commit(id: string, actualCredits: number, provider: string): Promise<void> {
  const usdPerCredit = DEFAULT_USD_PER_CREDIT[provider] ?? 0;
  await db()
    .update(providerUsage)
    .set({
      status: "committed",
      credits: actualCredits,
      costMicros: Math.round(actualCredits * usdPerCredit * 1e6),
    })
    .where(eq(providerUsage.id, id));
}

export async function release(id: string): Promise<void> {
  await db()
    .update(providerUsage)
    .set({ status: "released", credits: 0, costMicros: 0 })
    .where(eq(providerUsage.id, id));
}

/** Wrap a paid call: reserve → call → commit actual (or release on failure). */
export async function withBudget<T>(
  opts: {
    provider: string;
    operation: string;
    credits: number;
    runId?: string | null;
    taskId?: string | null;
    detail?: string;
  },
  fn: () => Promise<{ value: T; credits: number }>,
): Promise<T> {
  if (opts.credits <= 0) return (await fn()).value;
  const id = await reserve(opts);
  try {
    const r = await fn();
    await commit(id, r.credits, opts.provider);
    return r.value;
  } catch (e) {
    await release(id);
    throw e;
  }
}
