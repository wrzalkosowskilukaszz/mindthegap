import { randomUUID } from "node:crypto";
import { syncEvents } from "@/server/events/sync";
import { api } from "@/server/http";
import { acquireLease, releaseLease } from "@/server/jobs/lease";

export const maxDuration = 120;

/** Check the event sources now ("Odśwież teraz" on the Wydarzenia page). */
export const POST = api(async () => {
  const holder = `ui:${randomUUID().slice(0, 8)}`;
  if (!(await acquireLease("events", holder, 110_000))) return { busy: true };
  try {
    return { busy: false, ...(await syncEvents({ deadline: Date.now() + 90_000, force: true })) };
  } finally {
    await releaseLease("events", holder);
  }
});
