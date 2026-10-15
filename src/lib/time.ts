/**
 * Time helpers for the Europe/Warsaw schedule (DST-correct via Luxon/IANA tz data).
 */
import { DateTime } from "luxon";

export const DEFAULT_TZ = "Europe/Warsaw";

/** Local calendar date (YYYY-MM-DD) of an instant in the given zone. */
export function localDate(at: Date, zone = DEFAULT_TZ): string {
  return DateTime.fromJSDate(at, { zone }).toISODate()!;
}

/**
 * The instant of "HH:mm local time" on the local date of `at`.
 * On the spring-forward day a non-existent wall time (02:30) moves forward to the first valid
 * instant; on the fall-back day an ambiguous wall time resolves to the first occurrence.
 */
export function scheduledInstantForDate(dateIso: string, hhmm: string, zone = DEFAULT_TZ): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const dt = DateTime.fromISO(dateIso, { zone }).set({
    hour: h ?? 0,
    minute: m ?? 0,
    second: 0,
    millisecond: 0,
  });
  return dt.toJSDate();
}

/** Next scheduled instant strictly after `after`. */
export function nextScheduledInstant(after: Date, hhmm: string, zone = DEFAULT_TZ): Date {
  const today = localDate(after, zone);
  const todayAt = scheduledInstantForDate(today, hhmm, zone);
  if (todayAt.getTime() > after.getTime()) return todayAt;
  const tomorrow = DateTime.fromISO(today, { zone }).plus({ days: 1 }).toISODate()!;
  return scheduledInstantForDate(tomorrow, hhmm, zone);
}

export type DueDecision =
  | { due: false; reason: "paused" | "before_time" | "already_ran_today" }
  | { due: true; localDate: string; trigger: "schedule" | "catch_up"; scheduledAt: Date };

/**
 * Missed-run policy: one scheduled run per local day. A tick within `onTimeWindowMinutes` after the
 * scheduled time starts it as "schedule"; a later tick on the same local day starts it as "catch_up".
 * Missed days are never back-filled.
 */
export function decideScheduledRun(opts: {
  now: Date;
  enabled: boolean;
  localTime: string;
  zone?: string;
  ranForLocalDate: (date: string) => boolean;
  onTimeWindowMinutes?: number;
}): DueDecision {
  const zone = opts.zone ?? DEFAULT_TZ;
  if (!opts.enabled) return { due: false, reason: "paused" };
  const date = localDate(opts.now, zone);
  const at = scheduledInstantForDate(date, opts.localTime, zone);
  if (opts.now.getTime() < at.getTime()) return { due: false, reason: "before_time" };
  if (opts.ranForLocalDate(date)) return { due: false, reason: "already_ran_today" };
  const lateMs = opts.now.getTime() - at.getTime();
  const window = (opts.onTimeWindowMinutes ?? 75) * 60_000;
  return { due: true, localDate: date, trigger: lateMs <= window ? "schedule" : "catch_up", scheduledAt: at };
}

export function formatWarsaw(d: Date | string | null | undefined, fmt = "d LLL yyyy, HH:mm"): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? DateTime.fromISO(d) : DateTime.fromJSDate(d);
  return dt.setZone(DEFAULT_TZ).setLocale("pl").toFormat(fmt);
}

export function daysSince(d: Date | string | null | undefined, now = new Date()): number | null {
  if (!d) return null;
  const t = typeof d === "string" ? Date.parse(d) : d.getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}
