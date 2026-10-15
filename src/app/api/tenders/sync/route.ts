import { randomUUID } from "node:crypto";
import { api } from "@/server/http";
import { acquireLease, releaseLease } from "@/server/jobs/lease";
import { syncTenders } from "@/server/tenders/sync";

export const maxDuration = 120;

/** Read Baza Konkurencyjności now ("Odśwież teraz" on the Zapytania ofertowe page). */
export const POST = api(async () => {
  const holder = `ui:${randomUUID().slice(0, 8)}`;
  if (!(await acquireLease("tenders", holder, 110_000))) return { busy: true };
  try {
    return { busy: false, ...(await syncTenders({ deadline: Date.now() + 90_000 })) };
  } finally {
    await releaseLease("tenders", holder);
  }
});
