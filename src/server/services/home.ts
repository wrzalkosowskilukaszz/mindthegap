/** Numbers for the three cards at the top of Kontakty. Real counts only; nothing decorative is data. */
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { companies, contacts, inboundMessages, messages } from "../db/schema.ts";
import { coverage } from "./companies.ts";
import { buildWhere } from "./contact-list.ts";

const DAYS = 12;

export async function homeStats(now = new Date()) {
  const count = sql<number>`count(*)::int`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since = new Date(now.getTime() - (DAYS - 1) * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const [toContact] = await db()
    .select({ n: count })
    .from(contacts)
    .innerJoin(companies, eq(contacts.companyId, companies.id))
    .where(await buildWhere({ view: "to-contact" }));
  const perDay = (await db()
    .select({
      day: sql<string>`to_char(${contacts.discoveredAt} at time zone 'Europe/Warsaw', 'YYYY-MM-DD')`,
      n: count,
    })
    .from(contacts)
    .where(and(gte(contacts.discoveredAt, since), eq(contacts.isDemo, false)))
    .groupBy(sql`1`)) as { day: string; n: number }[];
  const byDay = new Map(perDay.map((r) => [r.day, r.n]));
  const newPerDay = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(since.getTime() + i * 86_400_000);
    const day = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
    return { day, n: byDay.get(day) ?? 0 };
  });
  const [sent] = await db()
    .select({ n: count })
    .from(messages)
    .where(and(eq(messages.status, "sent"), gte(messages.sentAt, monthStart)));
  const [replies] = await db()
    .select({ n: count })
    .from(inboundMessages)
    .where(
      and(eq(inboundMessages.classification, "human_reply"), gte(inboundMessages.receivedAt, monthStart)),
    );
  const cov = await coverage();
  return {
    toContact: toContact?.n ?? 0,
    newPerDay,
    companies: cov.total,
    researched: cov.researched,
    withRelevant: cov.withRelevantContact,
    sentThisMonth: sent?.n ?? 0,
    repliesThisMonth: replies?.n ?? 0,
  };
}

export type HomeStats = Awaited<ReturnType<typeof homeStats>>;
