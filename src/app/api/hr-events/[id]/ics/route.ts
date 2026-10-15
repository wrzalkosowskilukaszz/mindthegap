import { eventIcs } from "@/server/events/service";
import { api } from "@/server/http";

/** One event as a calendar file ("Dodaj do kalendarza"). */
export const GET = api<{ id: string }>(async (_req, { params }) => {
  const { body, filename } = await eventIcs(params.id);
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="event.ics"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
