import { z } from "zod";
import { addManualEvent, EVENT_VIEWS, listEvents } from "@/server/events/service";
import { api, parseBody, searchParams } from "@/server/http";

export const GET = api(async (req) => {
  const p = searchParams(req);
  const view = z
    .enum(EVENT_VIEWS)
    .catch("best")
    .parse(p.get("view") ?? "best");
  const offset = Math.max(0, Number(p.get("offset")) || 0);
  return listEvents({ view, q: p.get("q") ?? undefined, offset });
});

/** An event found elsewhere: link, title, date (and time), place or online. */
export const POST = api(async (req) => {
  const b = await parseBody(
    req,
    z.object({
      url: z.string().url().max(2000),
      title: z.string().trim().min(2).max(300),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .nullable()
        .optional(),
      place: z.string().trim().max(300).nullable().optional(),
      online: z.boolean().default(false),
      organiser: z.string().trim().max(200).nullable().optional(),
    }),
  );
  const { DateTime } = await import("luxon");
  const start = DateTime.fromISO(`${b.date}T${b.time ?? "00:00"}`, { zone: "Europe/Warsaw" });
  return {
    id: await addManualEvent({
      title: b.title,
      startsAt: start.toJSDate(),
      allDay: !b.time,
      place: b.place || null,
      online: b.online,
      url: b.url,
      organiser: b.organiser || null,
    }),
  };
});
