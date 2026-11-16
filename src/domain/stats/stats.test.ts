import { describe, expect, it } from "vitest";
import { FACTORY_NOW, makeCard, makeReviewLog } from "../../../tests/factories";
import { averageAnswerMs, DEFAULT_ANSWER_MS, estimateMinutes, forecastReviews } from "./index";

const SP = "America/Sao_Paulo";
const NOW = Date.parse("2026-11-16T15:00:00Z"); // 12:00 in São Paulo
const DAY = 86_400_000;
const review = (due: number, o = {}) =>
  makeCard({ queue: "review", state: "review", due, reps: 2, ...o });

describe("forecastReviews", () => {
  it("counts cards due on each of the next 7 study days, overdue counted today", () => {
    const cards = [
      review(NOW - 3 * DAY),
      review(NOW + 1_000),
      review(NOW + DAY),
      review(NOW + DAY + 1_000),
      review(NOW + 6 * DAY),
      review(NOW + 7 * DAY),
    ];
    expect(forecastReviews(cards, NOW, 4, SP)).toEqual([
      { day: "2026-11-16", count: 2 },
      { day: "2026-11-17", count: 2 },
      { day: "2026-11-18", count: 0 },
      { day: "2026-11-19", count: 0 },
      { day: "2026-11-20", count: 0 },
      { day: "2026-11-21", count: 0 },
      { day: "2026-11-22", count: 1 },
    ]);
  });

  it("buckets by study day, honouring the cutoff hour", () => {
    // 03:00 local on the 17th still belongs to study day 16.
    const at0300 = Date.parse("2026-11-17T06:00:00Z");
    expect(forecastReviews([review(at0300)], NOW, 4, SP)[0]).toEqual({
      day: "2026-11-16",
      count: 1,
    });
  });

  it("includes learning cards but not new, suspended, buried or deleted ones", () => {
    const cards = [
      makeCard({ queue: "learning", state: "learning", due: NOW, reps: 1 }),
      makeCard({ queue: "relearning", state: "relearning", due: NOW, reps: 4, lapses: 1 }),
      makeCard({ due: NOW }),
      review(NOW, { queue: "suspended" }),
      review(NOW, { queue: "buried", buriedUntilDay: "2026-11-17" }),
      review(NOW, { deletedAt: NOW }),
    ];
    expect(forecastReviews(cards, NOW, 4, SP)[0]?.count).toBe(2);
  });

  it("supports a custom number of days", () => {
    expect(forecastReviews([], NOW, 4, SP, 3).map((d) => d.day)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
    ]);
  });
});

describe("averageAnswerMs", () => {
  it("averages the durations of review logs that were not undone", () => {
    const logs = [
      makeReviewLog({ durationMs: 4_000 }),
      makeReviewLog({ durationMs: 8_000 }),
      makeReviewLog({ durationMs: 60_000, undoneAt: FACTORY_NOW }),
      makeReviewLog({ durationMs: 60_000, kind: "reset" }),
    ];
    expect(averageAnswerMs(logs)).toBe(6_000);
  });

  it("falls back to a default without history", () => {
    expect(averageAnswerMs([])).toBe(DEFAULT_ANSWER_MS);
    expect(DEFAULT_ANSWER_MS).toBe(10_000);
  });
});

describe("estimateMinutes", () => {
  it("multiplies the cards to study by the average answer time, rounding up", () => {
    expect(estimateMinutes({ new: 5, learning: 2, review: 13 }, 10_000)).toBe(4);
    expect(estimateMinutes({ new: 0, learning: 0, review: 7 }, 10_000)).toBe(2);
  });

  it("is zero with nothing to study", () => {
    expect(estimateMinutes({ new: 0, learning: 0, review: 0 }, 10_000)).toBe(0);
  });
});
