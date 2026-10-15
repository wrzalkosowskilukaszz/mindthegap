import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { jobRuns, jobTasks } from "@/server/db/schema";
import { api, notFound } from "@/server/http";

export const GET = api<{ id: string }>(async (_req, { params }) => {
  const [run] = await db().select().from(jobRuns).where(eq(jobRuns.id, params.id)).limit(1);
  if (!run) throw notFound();
  const tasks = await db()
    .select()
    .from(jobTasks)
    .where(eq(jobTasks.runId, params.id))
    .orderBy(asc(jobTasks.createdAt));
  return { run, tasks };
});
