import { z } from "zod";
import { addManualJob, JOB_VIEWS, listJobs } from "@/server/careers/service";
import { api, parseBody, searchParams } from "@/server/http";

export const GET = api(async (req) => {
  const p = searchParams(req);
  const view = z
    .enum(JOB_VIEWS)
    .catch("best")
    .parse(p.get("view") ?? "best");
  const offset = Math.max(0, Number(p.get("offset")) || 0);
  return listJobs({ view, q: p.get("q") ?? undefined, offset });
});

/** Adds an offer you found yourself (for example on LinkedIn): link, title, company and the ad text. */
export const POST = api(async (req) => {
  const b = await parseBody(
    req,
    z.object({
      url: z.string().url().max(2000),
      title: z.string().trim().min(2).max(300),
      companyName: z.string().trim().min(1).max(200),
      location: z.string().max(300).nullable().optional(),
      description: z.string().max(20_000).nullable().optional(),
    }),
  );
  return { id: await addManualJob(b) };
});
