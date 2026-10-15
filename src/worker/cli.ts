/**
 * Worker CLI — the same job engine as the HTTP tick, for local use, a VM cron or a Cloud Run Job.
 *   node --env-file=.env.local --import tsx src/worker/cli.ts tick [--seconds 900] [--no-discovery]
 *   ... run-now [--seconds 900]        create (or reuse) a manual discovery run and process it
 *   ... research <domain-or-slug>      research one company now (bounded crawl)
 *   ... discover-companies [--max 10]  find new companies (Wikidata)
 *   ... jobs [--seconds 120] [--no-detect]  read job boards and feeds now (Oferty pracy)
 *   ... status                         print scheduler / run status
 */
import { eq, or } from "drizzle-orm";
import { syncJobs } from "../server/careers/sync.ts";
import { closeDb, db } from "../server/db/client.ts";
import { companies } from "../server/db/schema.ts";
import { discoverCompanies } from "../server/discovery/company-discovery.ts";
import { PoliteFetcher } from "../server/discovery/fetcher.ts";
import { researchCompany } from "../server/discovery/research-company.ts";
import { createManualRun, processRun } from "../server/jobs/runs.ts";
import { runTick } from "../server/jobs/tick.ts";
import { discoveryStatus } from "../server/services/discovery-status.ts";
import { getSettings } from "../server/settings.ts";

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string, def?: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? (rest[i + 1] ?? "true") : def;
};

let exitCode = 0;
try {
  switch (cmd) {
    case "tick": {
      const r = await runTick({
        budgetMs: Number(flag("seconds", "900")) * 1000,
        trigger: "cli",
        discovery: !rest.includes("--no-discovery"),
      });
      console.log(JSON.stringify(r, null, 2));
      if (r.slices.some((s) => s.status === "failed")) exitCode = 2;
      break;
    }
    case "jobs": {
      const r = await syncJobs({
        deadline: Date.now() + Number(flag("seconds", "120")) * 1000,
        detect: !rest.includes("--no-detect"),
      });
      console.log(JSON.stringify(r, null, 2));
      break;
    }
    case "run-now": {
      const { run, reused } = await createManualRun();
      console.log(`${reused ? "Reusing active" : "Created"} run ${run.id}`);
      const r = await processRun(run.id, Date.now() + Number(flag("seconds", "900")) * 1000, "cli");
      console.log(JSON.stringify(r, null, 2));
      break;
    }
    case "research": {
      const key = rest[0];
      if (!key) throw new Error("usage: research <domain-or-slug>");
      const [co] = await db()
        .select()
        .from(companies)
        .where(or(eq(companies.domain, key), eq(companies.slug, key)))
        .limit(1);
      if (!co) throw new Error(`company not found: ${key}`);
      const s = await getSettings("discovery");
      const r = await researchCompany(co.id, {
        fetcher: new PoliteFetcher({ minDelayMs: s.minDelayMsPerHost }),
        deadline: Date.now() + 5 * 60_000,
        maxPages: s.maxPagesPerCompany,
        maxContacts: s.maxContactsPerCompany,
      });
      console.log(JSON.stringify(r, null, 2));
      break;
    }
    case "discover-companies": {
      const s = await getSettings("discovery");
      const r = await discoverCompanies({
        max: Number(flag("max", "10")),
        minEmployees: s.minEmployees,
        sectors: s.sectors,
        excludedDomains: s.excludedDomains,
      });
      console.log(JSON.stringify(r, null, 2));
      break;
    }
    case "status": {
      const s = await discoveryStatus();
      console.log(
        JSON.stringify(
          {
            scheduler: s.scheduler,
            active: s.active,
            lastSuccessfulRunAt: s.lastSuccessfulRunAt,
            spend: s.spend,
            coverage: s.coverage,
          },
          null,
          2,
        ),
      );
      break;
    }
    default:
      console.log("commands: tick | run-now | research <domain> | discover-companies | status");
      exitCode = 1;
  }
} catch (e) {
  console.error(e instanceof Error ? e.stack : e);
  exitCode = 1;
} finally {
  await closeDb();
}
process.exit(exitCode);
