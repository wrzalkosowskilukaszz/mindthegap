/** System status used by the sidebar, Kontakty › Odkrywanie and Ustawienia. */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { nextScheduledInstant } from "@/lib/time";
import { db } from "../db/client.ts";
import { appEvents, contacts, googleAccounts, jobRuns, messages, settings, tenders } from "../db/schema.ts";
import { integrations } from "../env.ts";
import { getSettings } from "../settings.ts";
import { TENDER_SHOW_FROM } from "../tenders/service.ts";

export async function systemStatus() {
  const sched = await getSettings("scheduler");
  const [lastRun] = await db()
    .select()
    .from(jobRuns)
    .where(eq(jobRuns.kind, "discovery"))
    .orderBy(desc(jobRuns.createdAt))
    .limit(1);
  const [lastOk] = await db()
    .select()
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.kind, "discovery"),
        sql`${jobRuns.status} in ('succeeded','partial','budget_exhausted')`,
      ),
    )
    .orderBy(desc(jobRuns.finishedAt))
    .limit(1);
  const [tick] = await db().select().from(settings).where(eq(settings.key, "tick_state")).limit(1);
  const lastTickAt = (tick?.value as { lastTickAt?: string } | undefined)?.lastTickAt ?? null;
  const [google] = await db()
    .select()
    .from(googleAccounts)
    .orderBy(desc(googleAccounts.connectedAt))
    .limit(1);
  const [{ openIssues } = { openIssues: 0 }] = await db()
    .select({ openIssues: sql<number>`count(*)::int` })
    .from(appEvents)
    .where(and(isNull(appEvents.resolvedAt), sql`${appEvents.level} in ('warning','error')`));
  const [{ newContacts } = { newContacts: 0 }] = await db()
    .select({ newContacts: sql<number>`count(*)::int` })
    .from(contacts)
    .where(eq(contacts.reviewStatus, "new"));
  const [{ drafts } = { drafts: 0 }] = await db()
    .select({ drafts: sql<number>`count(*)::int` })
    .from(messages)
    .where(sql`${messages.status} in ('draft','approved')`);
  // Relevant requests for quotes found in the last 3 days and not yet looked at.
  const [{ newTenders } = { newTenders: 0 }] = await db()
    .select({ newTenders: sql<number>`count(*)::int` })
    .from(tenders)
    .where(
      sql`${tenders.closedAt} is null and ${tenders.status} = 'new' and ${tenders.score} >= ${TENDER_SHOW_FROM} and ${tenders.firstSeenAt} >= now() - interval '3 days'`,
    );
  const scopes = google?.scopes ?? [];
  return {
    integrations: integrations(),
    scheduler: {
      ...sched,
      nextRunAt: sched.enabled
        ? nextScheduledInstant(new Date(), sched.localTime, sched.timezone).toISOString()
        : null,
      lastTickAt,
      tickHealthy: lastTickAt ? Date.now() - Date.parse(lastTickAt) < 3 * 3_600_000 : false,
    },
    lastRun: lastRun
      ? {
          id: lastRun.id,
          status: lastRun.status,
          createdAt: lastRun.createdAt.toISOString(),
          finishedAt: lastRun.finishedAt?.toISOString() ?? null,
        }
      : null,
    lastSuccessfulRunAt: lastOk?.finishedAt?.toISOString() ?? null,
    gmail: google
      ? {
          email: google.email,
          status: google.status,
          statusDetail: google.statusDetail,
          canSend: scopes.includes("https://www.googleapis.com/auth/gmail.send"),
          canRead:
            scopes.includes("https://www.googleapis.com/auth/gmail.metadata") ||
            scopes.includes("https://www.googleapis.com/auth/gmail.readonly"),
          lastSyncAt: google.lastSyncAt?.toISOString() ?? null,
          lastSyncOk: google.lastSyncOk,
          lastSyncError: google.lastSyncError,
        }
      : null,
    openIssues,
    newContacts,
    drafts,
    newTenders,
  };
}

export type SystemStatus = Awaited<ReturnType<typeof systemStatus>>;
