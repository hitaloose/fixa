import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FACTORY_NOW, makeCard } from "../../../tests/factories";
import { nextPractice, PRACTICE_WEIGHT, practicePool, seededRandom } from "./index";

const fixed = (value: number) => () => value;

describe("practicePool", () => {
  it("keeps every active card in any state, without suspended, buried or deleted ones", () => {
    const fresh = makeCard();
    const review = makeCard({ queue: "review", state: "review", reps: 3 });
    const learning = makeCard({ queue: "learning", state: "learning", reps: 1 });
    const suspended = makeCard({ queue: "suspended" });
    const buried = makeCard({ queue: "buried", buriedUntilDay: "2026-11-17" });
    const deleted = makeCard({ deletedAt: FACTORY_NOW + 1, updatedAt: FACTORY_NOW + 1 });
    expect(practicePool([fresh, review, learning, suspended, buried, deleted])).toEqual([
      fresh.id,
      review.id,
      learning.id,
    ]);
  });
});

describe("PRACTICE_WEIGHT", () => {
  it("weighs missed cards most and easy ones least", () => {
    expect(PRACTICE_WEIGHT).toEqual({ unseen: 1, 1: 4, 2: 2, 3: 1, 4: 0.5 });
  });
});

describe("nextPractice", () => {
  it("returns null for an empty pool", () => {
    expect(nextPractice({ pool: [], lastRating: {}, previousId: null, random: fixed(0) })).toBe(
      null,
    );
  });

  it("repeats the only card of a one-card pool", () => {
    expect(nextPractice({ pool: ["a"], lastRating: {}, previousId: "a", random: fixed(0.5) })).toBe(
      "a",
    );
  });

  it.each([
    // weights a=4 (Again), b=1 (unseen), c=0.5 (Easy): total 5.5, cumulative 4, 5, 5.5
    [0, "a"],
    [3.99 / 5.5, "a"],
    [4 / 5.5, "b"],
    [4.99 / 5.5, "b"],
    [5 / 5.5, "c"],
    [0.9999, "c"],
  ])("draws by cumulative weight (random %d → %s)", (r, expected) => {
    expect(
      nextPractice({
        pool: ["a", "b", "c"],
        lastRating: { a: 1, c: 4 },
        previousId: null,
        random: fixed(r),
      }),
    ).toBe(expected);
  });

  it("leaves the previous card out of the draw", () => {
    // without "a", weights b=2 (Hard), c=1 (Good): total 3
    const draw = (r: number) =>
      nextPractice({
        pool: ["a", "b", "c"],
        lastRating: { a: 1, b: 2, c: 3 },
        previousId: "a",
        random: fixed(r),
      });
    expect(draw(0)).toBe("b");
    expect(draw(1.99 / 3)).toBe("b");
    expect(draw(2 / 3)).toBe("c");
  });

  it("never deals the same card twice in a row", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 20 }),
        fc.string(),
        fc.array(fc.constantFrom(1, 2, 3, 4), { minLength: 1, maxLength: 50 }),
        (pool, seed, ratings) => {
          const random = seededRandom(seed);
          const lastRating: Record<string, 1 | 2 | 3 | 4> = {};
          let previous: string | null = null;
          for (const rating of ratings) {
            const next = nextPractice({ pool, lastRating, previousId: previous, random });
            expect(next).not.toBe(previous);
            expect(pool).toContain(next);
            lastRating[next as string] = rating;
            previous = next;
          }
        },
      ),
    );
  });

  it("deals missed cards more often than easy ones", () => {
    const random = seededRandom("practice");
    const seen = { again: 0, easy: 0 };
    for (let i = 0; i < 2000; i++) {
      const next = nextPractice({
        pool: ["again", "easy"],
        lastRating: { again: 1, easy: 4 },
        previousId: null,
        random,
      });
      seen[next as "again" | "easy"] += 1;
    }
    // expected ratio 4 : 0.5 → about 1778 : 222
    expect(seen.again).toBeGreaterThan(1650);
    expect(seen.easy).toBeGreaterThan(120);
  });
});
