import { describe, expect, it } from "vitest";
import { makeCard, makeReviewLog } from "../../../tests/factories";
import type { ReviewLog } from "../model";
import { buildStats } from "./index";

const TZ = "America/Sao_Paulo";
const NOW = Date.parse("2026-11-16T15:00:00Z"); // 12:00 local, study day 2026-11-16
const DAY = 86_400_000;
const at = (daysAgo: number, extra: Partial<ReviewLog> = {}) =>
  makeReviewLog({ reviewedAt: NOW - daysAgo * DAY, durationMs: 60_000, ...extra });

const input = (logs: ReviewLog[], periodDays = 7, cards = [makeCard()]) => ({
  logs,
  cards,
  now: NOW,
  cutoffHour: 4,
  timeZone: TZ,
  periodDays,
});

describe("buildStats", () => {
  it("summarises today", () => {
    const stats = buildStats(
      input([at(0, { rating: 1 }), at(0, { rating: 3 }), at(0, { rating: 4 }), at(1)]),
    );
    expect(stats.today).toEqual({ reviews: 3, minutes: 3, again: 1, correctRate: 2 / 3 });
  });

  it("has no correct rate on a day without answers", () => {
    expect(buildStats(input([])).today).toEqual({
      reviews: 0,
      minutes: 0,
      again: 0,
      correctRate: null,
    });
  });

  it("ignores undone logs and logs that are not answers", () => {
    const stats = buildStats(
      input([at(0, { undoneAt: NOW }), at(0, { kind: "reset" }), at(0, { kind: "reschedule" })]),
    );
    expect(stats.today.reviews).toBe(0);
    expect(stats.buttons).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 });
  });

  it("counts reviews and time per study day over the period, oldest first", () => {
    const stats = buildStats(input([at(0), at(0), at(2), at(9)], 3));
    expect(stats.daily).toEqual([
      { day: "2026-11-14", reviews: 1, ms: 60_000 },
      { day: "2026-11-15", reviews: 0, ms: 0 },
      { day: "2026-11-16", reviews: 2, ms: 120_000 },
    ]);
    expect(stats.time).toEqual({ totalMinutes: 3, minutesPerDay: 1 });
  });

  it("assigns answers before the cutoff hour to the previous study day", () => {
    const early = makeReviewLog({ reviewedAt: Date.parse("2026-11-16T06:30:00Z") }); // 03:30 local
    expect(buildStats(input([early], 2)).daily.map((d) => d.reviews)).toEqual([1, 0]);
  });

  it("keeps a year of activity for the heatmap", () => {
    const stats = buildStats(input([at(0), at(364), at(365)]));
    expect(stats.heatmap).toHaveLength(365);
    expect(stats.heatmap[0]).toEqual({ day: "2025-11-17", reviews: 1, ms: 60_000 });
    expect(stats.heatmap.at(-1)?.reviews).toBe(1);
  });

  it("measures true retention on review cards in the period", () => {
    const review = (daysAgo: number, rating: number) =>
      at(daysAgo, { rating, stateBefore: "review" });
    const stats = buildStats(
      input([
        review(0, 3),
        review(1, 2),
        review(2, 1),
        review(3, 4),
        at(0, { stateBefore: "new", rating: 1 }),
        review(30, 1),
      ]),
    );
    expect(stats.retention).toEqual({ passed: 3, total: 4, rate: 0.75 });
  });

  it("has no retention without review answers", () => {
    expect(buildStats(input([at(0)])).retention).toEqual({ passed: 0, total: 0, rate: null });
  });

  it.each([
    ["today and the days before", [0, 1, 2, 4], 3],
    ["up to yesterday when today has none yet", [1, 2], 2],
    ["broken by a missing yesterday", [0, 2, 3], 1],
    ["nothing recent", [3], 0],
  ])("streak: %s", (_name, daysAgo, expected) => {
    expect(buildStats(input((daysAgo as number[]).map((d) => at(d)))).streak).toBe(expected);
  });

  it("counts answers per button in the period", () => {
    const stats = buildStats(
      input([
        at(0, { rating: 1 }),
        at(1, { rating: 3 }),
        at(1, { rating: 3 }),
        at(8, { rating: 4 }),
      ]),
    );
    expect(stats.buttons).toEqual({ 1: 1, 2: 0, 3: 2, 4: 0 });
  });

  it("counts cards by state", () => {
    const cards = [
      makeCard(),
      makeCard({ queue: "learning", state: "learning" }),
      makeCard({ queue: "relearning", state: "relearning" }),
      makeCard({ queue: "review", state: "review" }),
      makeCard({ queue: "suspended", state: "review" }),
      makeCard({ queue: "buried", state: "new", buriedUntilDay: "2026-11-17" }),
    ];
    expect(buildStats(input([], 7, cards)).cardStates).toEqual({
      new: 1,
      learning: 2,
      review: 1,
      suspended: 1,
      buried: 1,
    });
  });
});
