/**
 * Lightweight analytics with explicit definitions. Unique recipients and total messages are never mixed.
 * Automatic replies and bounces are excluded from the human-reply metric (correctable per message).
 */
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { companies, contacts, inboundMessages, jobRuns, messages, providerUsage } from "../db/schema.ts";
import { coverage } from "./companies.ts";

export async function activityMetrics(from: Date, to: Date) {
  const inRange = (col: Parameters<typeof gte>[0]) => and(gte(col, from), lt(col, to));
  const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const count = sql<number>`count(*)::int`;

  const [cov, companiesResearchedInPeriod, newContacts, uniqueContacted, sent, humanReplies, autoReplies, bounces, failed, awaiting] = await Promise.all([
    coverage(),
    one(db().select({ n: count }).from(companies).where(inRange(companies.lastResearchedAt))),
    one(db().select({ n: count }).from(contacts).where(and(inRange(contacts.discoveredAt), eq(contacts.isDemo, false)))),
    one(db().select({ n: sql<number>`count(distinct ${messages.contactId})::int` }).from(messages).where(and(eq(messages.status, "sent"), inRange(messages.sentAt)))),
    one(db().select({ n: count }).from(messages).where(and(eq(messages.status, "sent"), inRange(messages.sentAt)))),
    one(db().select({ n: count }).from(inboundMessages).where(and(eq(inboundMessages.classification, "human_reply"), inRange(inboundMessages.receivedAt)))),
    one(db().select({ n: count }).from(inboundMessages).where(and(eq(inboundMessages.classification, "auto_reply"), inRange(inboundMessages.receivedAt)))),
    one(db().select({ n: count }).from(inboundMessages).where(and(eq(inboundMessages.classification, "bounce"), inRange(inboundMessages.receivedAt)))),
    one(db().select({ n: count }).from(messages).where(and(sql`${messages.status} in ('failed','uncertain')`, inRange(messages.updatedAt)))),
    one(db().select({ n: count }).from(contacts).where(sql`${contacts.outreachStatus} in ('sent','follow_up_due')`)),
  ]);
  const byVerification = await db()
    .select({ status: contacts.emailStatus, n: count })
    .from(contacts)
    .where(and(sql`${contacts.emailNormalized} is not null`, sql`${contacts.reviewStatus} <> 'rejected'`, eq(contacts.isDemo, false)))
    .groupBy(contacts.emailStatus);
  const costs = await db()
    .select({ provider: providerUsage.provider, operation: providerUsage.operation, credits: sql<number>`coalesce(sum(${providerUsage.credits}),0)::float8`, usd: sql<number>`(coalesce(sum(${providerUsage.costMicros}),0)/1e6)::float8` })
    .from(providerUsage)
    .where(and(eq(providerUsage.status, "committed"), inRange(providerUsage.createdAt)))
    .groupBy(providerUsage.provider, providerUsage.operation);
  const runs = await db()
    .select({ status: jobRuns.status, n: count })
    .from(jobRuns)
    .where(inRange(jobRuns.createdAt))
    .groupBy(jobRuns.status);
  const timeline = await db().execute<{ day: string; sent: number; replies: number; contacts: number }>(sql`
    with days as (select generate_series(date_trunc('day', ${from}::timestamptz at time zone 'Europe/Warsaw'), date_trunc('day', ${to}::timestamptz at time zone 'Europe/Warsaw'), interval '1 day') as d)
    select to_char(d, 'YYYY-MM-DD') as day,
      (select count(*) from messages m where m.status = 'sent' and (m.sent_at at time zone 'Europe/Warsaw')::date = d::date)::int as sent,
      (select count(*) from inbound_messages i where i.classification = 'human_reply' and (i.received_at at time zone 'Europe/Warsaw')::date = d::date)::int as replies,
      (select count(*) from contacts c where c.is_demo = false and (c.discovered_at at time zone 'Europe/Warsaw')::date = d::date)::int as contacts
    from days order by d`);
  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    coverage: cov,
    companiesResearchedInPeriod,
    newContacts,
    uniqueContacted,
    messagesSent: sent,
    humanReplies,
    autoReplies,
    bounces,
    failedOrUncertain: failed,
    awaitingReply: awaiting,
    byVerification: Object.fromEntries(byVerification.map((r) => [r.status, r.n])),
    costs,
    costTotalUsd: costs.reduce((a, c) => a + Number(c.usd), 0),
    runs: Object.fromEntries(runs.map((r) => [r.status, r.n])),
    timeline: timeline as unknown as { day: string; sent: number; replies: number; contacts: number }[],
  };
}

export type ActivityMetrics = Awaited<ReturnType<typeof activityMetrics>>;
