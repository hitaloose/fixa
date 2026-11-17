import { describe, expect, it } from "vitest";
import { FACTORY_NOW, makeCard, makePreset } from "../../../tests/factories";
import type { Card } from "../model";
import { simulateWorkload } from "./index";

const DAY = 86_400_000;
const NOW = FACTORY_NOW + 100 * DAY;

const reviewCard = (dueInDays: number, stability: number): Card =>
  makeCard({
    queue: "review",
    state: "review",
    reps: 3,
    stability,
    difficulty: 5,
    scheduledDays: Math.round(stability),
    due: NOW + dueInDays * DAY,
    lastReviewAt: NOW + dueInDays * DAY - Math.round(stability) * DAY,
  });

describe("simulateWorkload", () => {
  const preset = makePreset({ newPerDay: 5, reviewsPerDay: 9999 });

  it("is empty without cards", () => {
    const days = simulateWorkload({ cards: [], preset, days: 7, now: NOW, seed: "x" });
    expect(days).toHaveLength(7);
    expect(days.every((d) => d.reviews === 0 && d.newCards === 0)).toBe(true);
  });

  it("introduces new cards up to the daily limit", () => {
    const fresh = Array.from({ length: 12 }, (_, i) => makeCard({ newPosition: i }));
    const days = simulateWorkload({ cards: fresh, preset, days: 4, now: NOW, seed: "x" });
    expect(days.map((d) => d.newCards)).toEqual([5, 5, 2, 0]);
  });

  it("is reproducible with the same seed", () => {
    const cards = Array.from({ length: 30 }, (_, i) => reviewCard(i % 5, 3 + (i % 7)));
    const a = simulateWorkload({ cards, preset, days: 20, now: NOW, seed: "s" });
    const b = simulateWorkload({ cards, preset, days: 20, now: NOW, seed: "s" });
    expect(a).toEqual(b);
    expect(a[0]?.reviews).toBeGreaterThan(0);
  });

  it("asks for more reviews when the desired retention is higher", () => {
    const cards = Array.from({ length: 60 }, (_, i) => reviewCard(i % 10, 2 + (i % 9)));
    const total = (retention: number) =>
      simulateWorkload({
        cards,
        preset: { ...preset, desiredRetention: retention },
        days: 60,
        now: NOW,
        seed: "s",
      }).reduce((sum, d) => sum + d.reviews, 0);
    expect(total(0.97)).toBeGreaterThan(total(0.8));
  });

  it("never reviews more than the daily review limit", () => {
    const cards = Array.from({ length: 40 }, () => reviewCard(0, 5));
    const days = simulateWorkload({
      cards,
      preset: { ...preset, reviewsPerDay: 10 },
      days: 5,
      now: NOW,
      seed: "s",
    });
    expect(days.every((d) => d.reviews <= 10)).toBe(true);
    expect(days[0]?.reviews).toBe(10);
  });

  it("estimates minutes from the average answer time", () => {
    const cards = Array.from({ length: 6 }, () => reviewCard(0, 5));
    const [first] = simulateWorkload({
      cards,
      preset,
      days: 1,
      now: NOW,
      seed: "s",
      answerMs: 20_000,
    });
    expect(first?.minutes).toBe(Math.ceil(((first?.reviews ?? 0) * 20_000) / 60_000));
  });
});
