import fc from "fast-check";
import { default_w } from "ts-fsrs";
import { describe, expect, it } from "vitest";
import { FACTORY_NOW, makeCard, makePreset } from "../../../tests/factories";
import type { Card } from "../model";
import { answer, MAX_ANSWER_MS, previewIntervals, type Rating, replay } from "./index";

const MIN = 60_000;
const DAY = 86_400_000;
const NOW = FACTORY_NOW;
const preset = makePreset(); // learningSteps ["1m","10m"], relearningSteps ["10m"]

function review(
  card: Card,
  rating: Rating,
  now = NOW,
  logId = "00000000-0000-7000-b000-000000000001",
) {
  return answer({ card, rating, now, preset, durationMs: 4_000, logId });
}

/** A card that already graduated to review, due now. */
function reviewCard(overrides: Partial<Card> = {}): Card {
  return makeCard({
    queue: "review",
    state: "review",
    due: NOW,
    stability: 10,
    difficulty: 5,
    scheduledDays: 10,
    elapsedDays: 10,
    reps: 5,
    lapses: 0,
    lastReviewAt: NOW - 10 * DAY,
    ...overrides,
  });
}

describe("answer — new cards and learning steps", () => {
  it("Again on a new card starts learning at the first step (1m)", () => {
    const { nextCard } = review(makeCard(), 1);
    expect(nextCard).toMatchObject({
      queue: "learning",
      state: "learning",
      due: NOW + 1 * MIN,
      learningStep: 0,
      reps: 1,
      lapses: 0,
      lastReviewAt: NOW,
      updatedAt: NOW,
    });
  });

  it("Hard on a new card waits between the first two steps (6m)", () => {
    expect(review(makeCard(), 2).nextCard).toMatchObject({ queue: "learning", due: NOW + 6 * MIN });
  });

  it("Good on a new card advances to the second step (10m)", () => {
    expect(review(makeCard(), 3).nextCard).toMatchObject({
      queue: "learning",
      due: NOW + 10 * MIN,
      learningStep: 1,
    });
  });

  it("Easy on a new card graduates straight to review", () => {
    const { nextCard } = review(makeCard(), 4);
    expect(nextCard.queue).toBe("review");
    expect(nextCard.state).toBe("review");
    expect(nextCard.scheduledDays).toBeGreaterThanOrEqual(1);
    expect(nextCard.due).toBe(NOW + nextCard.scheduledDays * DAY);
  });

  it("Good on the last learning step graduates to review", () => {
    const step2 = review(makeCard(), 3).nextCard;
    const { nextCard } = review(step2, 3, step2.due);
    expect(nextCard).toMatchObject({ queue: "review", state: "review", learningStep: 0 });
    expect(nextCard.scheduledDays).toBeGreaterThanOrEqual(1);
  });

  it("Again during learning goes back to the first step", () => {
    const step2 = review(makeCard(), 3).nextCard;
    expect(review(step2, 1, step2.due).nextCard).toMatchObject({
      queue: "learning",
      learningStep: 0,
      due: step2.due + 1 * MIN,
    });
  });
});

describe("answer — review cards", () => {
  it("Again on a review card lapses into relearning (10m)", () => {
    expect(review(reviewCard({ lapses: 2 }), 1).nextCard).toMatchObject({
      queue: "relearning",
      state: "relearning",
      lapses: 3,
      due: NOW + 10 * MIN,
    });
  });

  it("Good on a review card schedules a longer interval than before", () => {
    const { nextCard } = review(reviewCard(), 3);
    expect(nextCard.queue).toBe("review");
    expect(nextCard.scheduledDays).toBeGreaterThan(10);
    expect(nextCard.due).toBe(NOW + nextCard.scheduledDays * DAY);
  });

  it("orders intervals Hard < Good < Easy", () => {
    const days = ([2, 3, 4] as const).map((r) => review(reviewCard(), r).nextCard.scheduledDays);
    expect(days[0]).toBeLessThan(days[1] ?? 0);
    expect(days[1]).toBeLessThan(days[2] ?? 0);
  });

  it("a higher desired retention schedules shorter intervals", () => {
    const at = (desiredRetention: number) =>
      answer({
        card: reviewCard(),
        rating: 3,
        now: NOW,
        preset: makePreset({ desiredRetention }),
        durationMs: 0,
        logId: "00000000-0000-7000-b000-000000000001",
      }).nextCard.scheduledDays;
    expect(at(0.97)).toBeLessThan(at(0.8));
  });

  it("caps the preview at the preset's maximum interval too", () => {
    const p = previewIntervals(
      reviewCard({
        stability: 400,
        scheduledDays: 300,
        elapsedDays: 300,
        lastReviewAt: NOW - 300 * DAY,
      }),
      NOW,
      makePreset({ maximumIntervalDays: 30 }),
    );
    expect(p.easy).toBe(30 * DAY);
  });

  it("never schedules beyond the preset's maximum interval", () => {
    const { nextCard } = answer({
      card: reviewCard({
        stability: 400,
        scheduledDays: 300,
        elapsedDays: 300,
        lastReviewAt: NOW - 300 * DAY,
      }),
      rating: 4,
      now: NOW,
      preset: makePreset({ maximumIntervalDays: 30 }),
      durationMs: 0,
      logId: "00000000-0000-7000-b000-000000000001",
    });
    expect(nextCard.scheduledDays).toBe(30);
  });

  it("uses the preset's own FSRS weights when set", () => {
    const withWeights = (fsrsWeights: number[] | null) =>
      answer({
        card: reviewCard(),
        rating: 3,
        now: NOW,
        preset: makePreset({ fsrsWeights }),
        durationMs: 0,
        logId: "00000000-0000-7000-b000-000000000001",
      }).nextCard;
    const slowerForgetting = default_w.map((w, i) => (i === 8 ? w * 1.5 : w));
    expect(scheduling(withWeights([...default_w]))).toEqual(scheduling(withWeights(null)));
    expect(withWeights(slowerForgetting).scheduledDays).not.toBe(withWeights(null).scheduledDays);
  });

  it("refuses to preview a suspended card", () => {
    expect(() => previewIntervals(reviewCard({ queue: "suspended" }), NOW, preset)).toThrow(
      /suspended/,
    );
  });

  it("refuses to schedule a suspended or buried card", () => {
    expect(() => review(reviewCard({ queue: "suspended" }), 3)).toThrow(/suspended/);
    expect(() => review(reviewCard({ queue: "buried", buriedUntilDay: "2026-11-17" }), 3)).toThrow(
      /buried/,
    );
  });

  it("does not mutate the input card", () => {
    const card = reviewCard();
    const before = structuredClone(card);
    review(card, 1);
    expect(card).toEqual(before);
  });
});

describe("answer — review log", () => {
  it("records the answer with a snapshot of the card before it (for undo)", () => {
    const card = reviewCard();
    const { nextCard, reviewLog } = review(card, 3);
    expect(reviewLog).toEqual({
      id: "00000000-0000-7000-b000-000000000001",
      cardId: card.id,
      reviewedAt: NOW,
      rating: 3,
      stateBefore: "review",
      cardBefore: {
        queue: card.queue,
        state: card.state,
        buriedUntilDay: card.buriedUntilDay,
        due: card.due,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsedDays: card.elapsedDays,
        scheduledDays: card.scheduledDays,
        learningStep: card.learningStep,
        reps: card.reps,
        lapses: card.lapses,
        lastReviewAt: card.lastReviewAt,
      },
      scheduledDays: nextCard.scheduledDays,
      elapsedDays: 10,
      durationMs: 4_000,
      kind: "review",
      undoneAt: null,
    });
  });

  it.each([
    [MAX_ANSWER_MS + 1, MAX_ANSWER_MS],
    [MAX_ANSWER_MS, MAX_ANSWER_MS],
    [12_345, 12_345],
    [-5, 0],
  ])("caps the answer duration: %i ms is logged as %i ms", (durationMs, logged) => {
    const { reviewLog } = answer({
      card: makeCard(),
      rating: 3,
      now: NOW,
      preset,
      durationMs,
      logId: "00000000-0000-7000-b000-000000000001",
    });
    expect(reviewLog.durationMs).toBe(logged);
  });

  it("caps durations at 60 seconds by default", () => {
    expect(MAX_ANSWER_MS).toBe(60_000);
  });
});

describe("answer — leeches", () => {
  it("flags a leech when a lapse reaches the threshold (tag action)", () => {
    const { nextCard, leech } = review(reviewCard({ lapses: 7 }), 1);
    expect(leech).toBe("tag");
    expect(nextCard.queue).toBe("relearning");
  });

  it("suspends the card when the leech action is suspend, keeping its FSRS state", () => {
    const { nextCard, leech } = answer({
      card: reviewCard({ lapses: 7 }),
      rating: 1,
      now: NOW,
      preset: makePreset({ leechAction: "suspend" }),
      durationMs: 0,
      logId: "00000000-0000-7000-b000-000000000001",
    });
    expect(leech).toBe("suspend");
    expect(nextCard).toMatchObject({ queue: "suspended", state: "relearning", lapses: 8 });
  });

  it("is not a leech below the threshold", () => {
    expect(review(reviewCard({ lapses: 6 }), 1).leech).toBeNull();
  });

  it("is not a leech when the answer is not a lapse", () => {
    expect(review(reviewCard({ lapses: 9 }), 3).leech).toBeNull();
  });
});

describe("previewIntervals", () => {
  it("shows the learning steps for a new card", () => {
    const p = previewIntervals(makeCard(), NOW, preset);
    expect(p).toMatchObject({ again: 1 * MIN, hard: 6 * MIN, good: 10 * MIN });
    expect(p.easy).toBeGreaterThanOrEqual(DAY);
  });

  it("matches what answering would schedule, for every rating", () => {
    const card = reviewCard();
    const p = previewIntervals(card, NOW, preset);
    const ratings = { again: 1, hard: 2, good: 3, easy: 4 } as const;
    for (const [key, rating] of Object.entries(ratings)) {
      expect(p[key as keyof typeof p]).toBe(review(card, rating).nextCard.due - NOW);
    }
  });
});

/** Scheduling fields only (cards built in different calls get different IDs). */
const scheduling = (c: Card) => ({
  queue: c.queue,
  state: c.state,
  due: c.due,
  stability: c.stability,
  difficulty: c.difficulty,
  elapsedDays: c.elapsedDays,
  scheduledDays: c.scheduledDays,
  learningStep: c.learningStep,
  reps: c.reps,
  lapses: c.lapses,
  lastReviewAt: c.lastReviewAt,
});

const ratingSeq = fc.array(fc.constantFrom<Rating>(1, 2, 3, 4), { minLength: 1, maxLength: 12 });

/** Answers each rating when the card becomes due (plus `waits` extra minutes). */
function study(ratings: Rating[], waits: number[] = []) {
  let card = makeCard();
  let now = NOW;
  const logs = [];
  for (const [i, rating] of ratings.entries()) {
    now = Math.max(now, card.due) + (waits[i] ?? 0) * MIN;
    const result = answer({
      card,
      rating,
      now,
      preset,
      durationMs: 1_000,
      logId: `00000000-0000-7000-b000-${String(i).padStart(12, "0")}`,
    });
    expect(result.nextCard.due).toBeGreaterThanOrEqual(now);
    expect(result.nextCard.reps).toBe(card.reps + 1);
    card = result.nextCard;
    logs.push(result.reviewLog);
  }
  return { card, logs };
}

describe("scheduler properties", () => {
  it("never schedules in the past and always counts the repetition", () => {
    fc.assert(
      fc.property(
        ratingSeq,
        fc.array(fc.integer({ min: 0, max: 60 * 24 * 30 }), { maxLength: 12 }),
        (r, w) => {
          study(r, w);
        },
      ),
    );
  });

  it("is deterministic: the same answers at the same instants give the same card", () => {
    fc.assert(
      fc.property(ratingSeq, (r) => {
        expect(scheduling(study(r).card)).toEqual(scheduling(study(r).card));
      }),
    );
  });

  it("is reproducible: a fixed sequence yields the recorded schedule", () => {
    const { logs, card } = study([3, 3, 3, 1, 3, 3, 4]);
    const schedule = logs.map((l) => [l.rating, l.stateBefore, l.scheduledDays]);
    expect({
      schedule,
      final: {
        state: card.state,
        reps: card.reps,
        lapses: card.lapses,
        scheduledDays: card.scheduledDays,
      },
    }).toMatchSnapshot();
  });
});

describe("replay", () => {
  it("rebuilds the same scheduling state as answering in sequence", () => {
    fc.assert(
      fc.property(ratingSeq, (r) => {
        const { card, logs } = study(r);
        expect(scheduling(replay(makeCard({ id: card.id }), logs, preset))).toEqual(
          scheduling(card),
        );
      }),
    );
  });

  it("applies logs in review order regardless of input order", () => {
    const { card, logs } = study([3, 3, 1, 3]);
    expect(scheduling(replay(makeCard(), [...logs].reverse(), preset))).toEqual(scheduling(card));
  });

  it("ignores undone logs", () => {
    const { logs } = study([3, 3]);
    const [first, second] = logs;
    if (!first || !second) throw new Error("expected two logs");
    const expected = study([3]).card;
    const replayed = replay(makeCard(), [first, { ...second, undoneAt: NOW }], preset);
    expect(scheduling(replayed)).toEqual(scheduling(expected));
  });

  it("starts from a new card even if the given card already has progress", () => {
    const { card, logs } = study([3, 3, 3]);
    expect(scheduling(replay(card, logs, preset))).toEqual(scheduling(card));
  });

  it("with no logs, returns a new card due at its creation", () => {
    const card = reviewCard({ createdAt: NOW - DAY, updatedAt: NOW });
    expect(replay(card, [], preset)).toMatchObject({
      queue: "new",
      state: "new",
      due: NOW - DAY,
      reps: 0,
      lapses: 0,
      stability: 0,
      lastReviewAt: null,
    });
  });

  it("restarts from a new card at a reset log", () => {
    const { logs } = study([3, 3, 3]);
    const last = logs.at(-1);
    if (!last) throw new Error("expected logs");
    const reset = {
      ...last,
      id: "00000000-0000-7000-b000-0000000000ff",
      kind: "reset" as const,
      reviewedAt: last.reviewedAt + DAY,
    };
    expect(replay(makeCard(), [...logs, reset], preset)).toMatchObject({
      queue: "new",
      state: "new",
      reps: 0,
      lapses: 0,
      lastReviewAt: null,
    });
  });

  it.each(["reschedule", "manual"] as const)(
    "refuses %s logs until their semantics exist",
    (kind) => {
      const { logs } = study([3]);
      const [log] = logs;
      if (!log) throw new Error("expected a log");
      expect(() => replay(makeCard(), [{ ...log, kind }], preset)).toThrow(new RegExp(kind));
    },
  );

  it("keeps a buried card buried until the same day", () => {
    const { card, logs } = study([3, 3]);
    const buried = { ...card, queue: "buried" as const, buriedUntilDay: "2026-11-17" };
    expect(replay(buried, logs, preset)).toMatchObject({
      queue: "buried",
      buriedUntilDay: "2026-11-17",
      state: card.state,
    });
  });

  it("does not suspend during replay even if the history contains a leech", () => {
    const leechy = makePreset({ leechThreshold: 1, leechAction: "suspend" });
    const id = "00000000-0000-7000-b000-0000000000aa";
    const graduate = answer({
      card: makeCard(),
      rating: 4,
      now: NOW,
      preset: leechy,
      durationMs: 0,
      logId: id,
    });
    const at = graduate.nextCard.due;
    const lapse = answer({
      card: graduate.nextCard,
      rating: 1,
      now: at,
      preset: leechy,
      durationMs: 0,
      logId: id,
    });
    expect(lapse.nextCard.queue).toBe("suspended");
    const replayed = replay(makeCard(), [graduate.reviewLog, lapse.reviewLog], leechy);
    expect(replayed).toMatchObject({ queue: "relearning", state: "relearning", lapses: 1 });
  });

  it("keeps a suspended card suspended, with the replayed FSRS state", () => {
    const { card, logs } = study([3, 3]);
    const suspended = { ...card, queue: "suspended" as const };
    const replayed = replay(suspended, logs, preset);
    expect(replayed.queue).toBe("suspended");
    expect(replayed.state).toBe(card.state);
  });

  it("changes only scheduling fields", () => {
    const { card, logs } = study([3]);
    const replayed = replay(card, logs, preset);
    expect({ ...replayed, ...scheduling(card) }).toEqual(card);
  });
});
