import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, db } from "../src/server/db/client.ts";
import { jobRuns, jobTasks, providerUsage } from "../src/server/db/schema.ts";
import {
  BudgetExceededError,
  recordUsage,
  reserve,
  spendSummary,
  withBudget,
} from "../src/server/jobs/budget.ts";
import { acquireLease, releaseLease } from "../src/server/jobs/lease.ts";
import { createManualRun, createScheduledRun, processRun } from "../src/server/jobs/runs.ts";
import { patchSettings } from "../src/server/settings.ts";
import { hasDb, resetDb } from "./db.ts";

describe.skipIf(!hasDb)("job engine", () => {
  beforeEach(async () => {
    await resetDb();
    // No companies and no company discovery: runs complete without network access.
    await patchSettings("discovery", {
      maxNewCompaniesPerRun: 0,
      monthlyProviderCredits: { hunter: 2 },
      dailySpendLimitUsd: 1,
      monthlySpendLimitUsd: 5,
    });
  });
  afterAll(closeDb);

  it("creates at most one scheduled run per local day (idempotent, safe under duplicate cron calls)", async () => {
    expect(await createScheduledRun("2026-10-15", "schedule")).not.toBeNull();
    expect(await createScheduledRun("2026-10-15", "catch_up")).toBeNull();
    expect(await db().select().from(jobRuns)).toHaveLength(1);
  });

  it("'Run now' reuses an active run instead of starting an overlapping one", async () => {
    const a = await createManualRun();
    const b = await createManualRun();
    expect(b.reused).toBe(true);
    expect(b.run.id).toBe(a.run.id);
  });

  it("plans once, processes, and finishes honestly", async () => {
    const { run } = await createManualRun();
    const r = await processRun(run.id, Date.now() + 30_000, "test");
    expect(r.finished).toBe(true);
    expect(r.status).toBe("succeeded");
    // Re-processing a finished run is a no-op.
    expect((await processRun(run.id, Date.now() + 5_000, "test")).processed).toBe(0);
    expect(await db().select().from(jobTasks).where(eq(jobTasks.runId, run.id))).toHaveLength(1);
  });

  it("leases are exclusive until released or expired", async () => {
    expect(await acquireLease("x", "a", 60_000)).toBe(true);
    expect(await acquireLease("x", "b", 60_000)).toBe(false);
    await releaseLease("x", "a");
    expect(await acquireLease("x", "b", 60_000)).toBe(true);
    expect(await acquireLease("y", "a", -1)).toBe(true); // already expired
    expect(await acquireLease("y", "b", 60_000)).toBe(true);
  });

  it("spending limits stop paid operations and failed calls release their reservation", async () => {
    await reserve({ provider: "hunter", operation: "domain-search", credits: 2 });
    await expect(
      reserve({ provider: "hunter", operation: "domain-search", credits: 1 }),
    ).rejects.toBeInstanceOf(BudgetExceededError);
    await db().delete(providerUsage);
    await expect(
      withBudget({ provider: "hunter", operation: "email-finder", credits: 1 }, async () => {
        throw new Error("provider down");
      }),
    ).rejects.toThrow("provider down");
    const [u] = await db().select().from(providerUsage);
    expect(u!.status).toBe("released");
  });

  it("AI you start yourself is recorded but never uses up the automatic discovery limits", async () => {
    // 1,000 k-tokens at the default $25 per million tokens = $25: far above the $1 daily limit.
    await recordUsage({ provider: "anthropic", operation: "ui:email-generate", credits: 1000 });
    expect((await spendSummary()).dayUsd).toBe(0);
    await expect(
      reserve({ provider: "anthropic", operation: "assisted-extraction", credits: 16 }),
    ).resolves.toBeTypeOf("string");
    // Automatic AI work is limited: 16 k-tokens ($0.40) fits, 30 more ($0.75) would pass the $1 day.
    await expect(
      reserve({ provider: "anthropic", operation: "assisted-extraction", credits: 30 }),
    ).rejects.toBeInstanceOf(BudgetExceededError);
  });
});
