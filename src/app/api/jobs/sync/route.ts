import { randomUUID } from "node:crypto";
import { syncJobs } from "@/server/careers/sync";
import { api } from "@/server/http";
import { acquireLease, releaseLease } from "@/server/jobs/lease";

export const maxDuration = 60;

/** One bounded slice (≈40 s) of the job sync, driven from the Oferty pracy page ("Odśwież teraz"). */
export const POST = api(async () => {
  const holder = `ui:${randomUUID().slice(0, 8)}`;
  if (!(await acquireLease("jobs", holder, 90_000))) return { busy: true };
  try {
    return { busy: false, ...(await syncJobs({ deadline: Date.now() + 45_000 })) };
  } finally {
    await releaseLease("jobs", holder);
  }
});
