import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { addDays, daysBetween, endOfStudyDay, studyDay } from "./index";

const SP = "America/Sao_Paulo"; // UTC-3, no DST
const LISBON = "Europe/Lisbon"; // DST: 2026-03-29 01:00Z (+1h), 2026-10-25 01:00Z (-1h)
const at = (iso: string) => Date.parse(iso);

describe("studyDay", () => {
  it.each([
    ["midday", "2026-11-16T15:00:00Z", 4, "2026-11-16"],
    ["03:59 local still belongs to the previous day", "2026-11-16T06:59:00Z", 4, "2026-11-15"],
    ["04:00 local starts the new day", "2026-11-16T07:00:00Z", 4, "2026-11-16"],
    ["00:30 local counts for the previous day", "2026-11-16T03:30:00Z", 4, "2026-11-15"],
    ["cutoff 0: midnight starts the day", "2026-11-16T03:00:00Z", 0, "2026-11-16"],
    ["cutoff 0: 23:59 is the same day", "2026-11-17T02:59:00Z", 0, "2026-11-16"],
    ["year boundary", "2027-01-01T05:00:00Z", 4, "2026-12-31"],
    ["leap day", "2028-03-01T04:00:00Z", 4, "2028-02-29"],
    ["cutoff 23", "2026-11-17T01:59:00Z", 23, "2026-11-15"],
  ])("São Paulo — %s", (_label, iso, cutoff, day) => {
    expect(studyDay(at(iso), cutoff, SP)).toBe(day);
  });

  it.each([
    ["spring forward: 03:30 WET is still the previous day", "2026-03-29T02:30:00Z", "2026-03-28"],
    ["spring forward: 04:30 WEST is the new day", "2026-03-29T03:30:00Z", "2026-03-29"],
    ["fall back: 03:59 WET is still the previous day", "2026-10-25T03:59:00Z", "2026-10-24"],
    ["fall back: 04:00 WET is the new day", "2026-10-25T04:00:00Z", "2026-10-25"],
  ])("Lisbon DST — %s", (_label, iso, day) => {
    expect(studyDay(at(iso), 4, LISBON)).toBe(day);
  });

  it("depends on the device time zone (travelling changes the day)", () => {
    const instant = at("2026-11-16T05:00:00Z");
    expect(studyDay(instant, 4, "UTC")).toBe("2026-11-16");
    expect(studyDay(instant, 4, SP)).toBe("2026-11-15");
  });

  it.each([-1, 24, 1.5])("rejects cutoff hour %f", (cutoff) => {
    expect(() => studyDay(0, cutoff, SP)).toThrow(
      new RangeError(`cutoffHour must be an integer 0–23, got ${cutoff}`),
    );
  });
});

describe("endOfStudyDay", () => {
  it.each([
    ["afternoon → next day's cutoff", "2026-11-16T15:00:00Z", SP, "2026-11-17T07:00:00.000Z"],
    ["before cutoff → today's cutoff", "2026-11-16T06:00:00Z", SP, "2026-11-16T07:00:00.000Z"],
    [
      "exactly at cutoff → next day's cutoff",
      "2026-11-16T07:00:00Z",
      SP,
      "2026-11-17T07:00:00.000Z",
    ],
    [
      "across spring forward (04:00 WEST)",
      "2026-03-28T12:00:00Z",
      LISBON,
      "2026-03-29T03:00:00.000Z",
    ],
    ["across fall back (04:00 WET)", "2026-10-24T12:00:00Z", LISBON, "2026-10-25T04:00:00.000Z"],
    [
      "half-hour zone (Kolkata, +05:30)",
      "2026-11-16T12:00:00Z",
      "Asia/Kolkata",
      "2026-11-16T22:30:00.000Z",
    ],
  ])("%s", (_label, iso, tz, end) => {
    expect(new Date(endOfStudyDay(at(iso), 4, tz)).toISOString()).toBe(end);
  });

  it("when the cutoff wall time is skipped (DST gap), ends when clocks jump past it", () => {
    // Sydney 2026-10-04: 02:00 AEST jumps to 03:00 AEDT at 16:00Z on Oct 3.
    const end = endOfStudyDay(at("2026-10-03T03:00:00Z"), 2, "Australia/Sydney");
    expect(new Date(end).toISOString()).toBe("2026-10-03T16:00:00.000Z");
  });

  it("when the cutoff wall time happens twice (DST end), ends at its first occurrence", () => {
    // Sydney 2026-04-05: 03:00 AEDT falls back to 02:00 AEST; 02:00 first occurs at 15:00Z on Apr 4.
    const end = endOfStudyDay(at("2026-04-04T03:00:00Z"), 2, "Australia/Sydney");
    expect(new Date(end).toISOString()).toBe("2026-04-04T15:00:00.000Z");
  });

  it("is the first instant of the next study day, for any instant and zone", () => {
    const zones = fc.constantFrom(
      "UTC",
      SP,
      LISBON,
      "America/New_York",
      "Asia/Tokyo",
      "Australia/Sydney",
      "Asia/Kolkata",
      "Asia/Kathmandu",
    );
    const instants = fc.integer({
      min: at("2020-01-01T00:00:00Z"),
      max: at("2035-01-01T00:00:00Z"),
    });
    const cutoffs = fc.integer({ min: 0, max: 23 });
    fc.assert(
      fc.property(instants, cutoffs, zones, (now, cutoff, tz) => {
        const end = endOfStudyDay(now, cutoff, tz);
        const today = studyDay(now, cutoff, tz);
        expect(end).toBeGreaterThan(now);
        expect(studyDay(end - 1, cutoff, tz)).toBe(today);
        expect(studyDay(end, cutoff, tz)).toBe(addDays(today, 1));
      }),
    );
  });
});

describe("addDays / daysBetween", () => {
  it.each([
    ["2026-11-16", 1, "2026-11-17"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2027-02-28", 1, "2027-03-01"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2026-11-16", 0, "2026-11-16"],
    ["2026-11-16", 30, "2026-12-16"],
  ])("addDays(%s, %i) = %s", (day, n, expected) => {
    expect(addDays(day, n)).toBe(expected);
  });

  it.each([
    ["2026-11-16", "2026-11-18", 2],
    ["2026-11-18", "2026-11-16", -2],
    ["2026-12-31", "2027-01-01", 1],
    ["2026-03-28", "2026-03-30", 2],
  ])("daysBetween(%s, %s) = %i", (a, b, n) => {
    expect(daysBetween(a, b)).toBe(n);
  });

  it("addDays and daysBetween are inverse", () => {
    const day = fc.integer({ min: 0, max: 20_000 }).map((n) => addDays("2000-01-01", n));
    fc.assert(
      fc.property(day, fc.integer({ min: -3_000, max: 3_000 }), (d, n) => {
        expect(daysBetween(d, addDays(d, n))).toBe(n);
      }),
    );
  });
});
