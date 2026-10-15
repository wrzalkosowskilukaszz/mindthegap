import { describe, expect, it } from "vitest";
import { decideScheduledRun, nextScheduledInstant, scheduledInstantForDate } from "./time.ts";

describe("Europe/Warsaw schedule", () => {
  it("07:00 local is 05:00 UTC in summer and 06:00 UTC in winter", () => {
    expect(scheduledInstantForDate("2026-07-01", "07:00").toISOString()).toBe("2026-07-01T05:00:00.000Z");
    expect(scheduledInstantForDate("2026-12-01", "07:00").toISOString()).toBe("2026-12-01T06:00:00.000Z");
  });
  it("handles both DST transition days", () => {
    // 2026-03-29: clocks go forward at 02:00; 2026-10-25: back at 03:00.
    expect(scheduledInstantForDate("2026-03-29", "07:00").toISOString()).toBe("2026-03-29T05:00:00.000Z");
    expect(scheduledInstantForDate("2026-10-25", "07:00").toISOString()).toBe("2026-10-25T06:00:00.000Z");
    // A non-existent wall time moves forward instead of failing.
    expect(scheduledInstantForDate("2026-03-29", "02:30").getTime()).toBeGreaterThan(
      Date.parse("2026-03-29T00:00:00Z"),
    );
  });
  it("finds the next run across the autumn change", () => {
    const after = new Date("2026-10-24T06:00:00Z"); // 08:00 local, after today's run
    expect(nextScheduledInstant(after, "07:00").toISOString()).toBe("2026-10-25T06:00:00.000Z");
  });
  it("decides on-time, catch-up and duplicate runs", () => {
    const base = { enabled: true, localTime: "07:00", ranForLocalDate: () => false };
    expect(decideScheduledRun({ ...base, now: new Date("2026-07-01T04:30:00Z") })).toEqual({
      due: false,
      reason: "before_time",
    });
    expect(decideScheduledRun({ ...base, now: new Date("2026-07-01T05:10:00Z") })).toMatchObject({
      due: true,
      trigger: "schedule",
      localDate: "2026-07-01",
    });
    expect(decideScheduledRun({ ...base, now: new Date("2026-07-01T12:00:00Z") })).toMatchObject({
      due: true,
      trigger: "catch_up",
    });
    expect(
      decideScheduledRun({ ...base, ranForLocalDate: () => true, now: new Date("2026-07-01T05:10:00Z") }),
    ).toEqual({ due: false, reason: "already_ran_today" });
    expect(decideScheduledRun({ ...base, enabled: false, now: new Date("2026-07-01T05:10:00Z") })).toEqual({
      due: false,
      reason: "paused",
    });
  });
  it("uses the Warsaw date, not the UTC date, near midnight", () => {
    // 23:30 UTC on 30 June is 01:30 on 1 July in Warsaw: before 07:00 on the new local day.
    expect(
      decideScheduledRun({
        enabled: true,
        localTime: "07:00",
        ranForLocalDate: () => false,
        now: new Date("2026-06-30T23:30:00Z"),
      }),
    ).toEqual({ due: false, reason: "before_time" });
  });
});
