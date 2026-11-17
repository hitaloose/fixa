import { describe, expect, it } from "vitest";
import { FACTORY_NOW, makeCard, makeNote, makeReviewLog } from "../../../tests/factories";
import { customQueue, forgottenToday, reviewAhead, studyByTag } from "./index";

const DAY = 86_400_000;
const NOW = FACTORY_NOW + 10 * DAY;
const START = NOW - 6 * 3_600_000; // start of the study day
const END = START + DAY;

describe("forgottenToday", () => {
  it("picks cards answered Again today, most recent last, once each", () => {
    const a = makeCard();
    const b = makeCard();
    const c = makeCard();
    const logs = [
      makeReviewLog({ cardId: a.id, rating: 1, reviewedAt: START + 10 }),
      makeReviewLog({ cardId: b.id, rating: 1, reviewedAt: START + 5 }),
      makeReviewLog({ cardId: a.id, rating: 1, reviewedAt: START + 20 }),
      makeReviewLog({ cardId: c.id, rating: 3, reviewedAt: START + 30 }),
      makeReviewLog({ cardId: c.id, rating: 1, reviewedAt: START - 1 }),
      makeReviewLog({ cardId: c.id, rating: 1, reviewedAt: START + 40, undoneAt: START + 41 }),
    ];
    expect(forgottenToday([a, b, c], logs, START)).toEqual([b.id, a.id]);
  });

  it("skips suspended and deleted cards", () => {
    const suspended = makeCard({ queue: "suspended" });
    const deleted = makeCard({ deletedAt: FACTORY_NOW + 1, updatedAt: FACTORY_NOW + 1 });
    const logs = [suspended, deleted].map((c) =>
      makeReviewLog({ cardId: c.id, rating: 1, reviewedAt: START + 1 }),
    );
    expect(forgottenToday([suspended, deleted], logs, START)).toEqual([]);
  });
});

describe("studyByTag", () => {
  it("picks active cards whose note has the tag (or a child tag), due ones first then new", () => {
    const tagged = makeNote({ tags: ["verbos::irregulares"] });
    const other = makeNote({ tags: ["nomes"] });
    const fresh = makeCard({ noteId: tagged.id, newPosition: 1 });
    const review = makeCard({
      noteId: tagged.id,
      templateOrd: 1,
      queue: "review",
      state: "review",
      due: NOW + 5 * DAY,
      reps: 2,
    });
    const suspended = makeCard({ noteId: tagged.id, templateOrd: 2, queue: "suspended" });
    const untagged = makeCard({ noteId: other.id });
    expect(studyByTag([fresh, review, suspended, untagged], [tagged, other], "Verbos")).toEqual([
      review.id,
      fresh.id,
    ]);
  });
});

describe("reviewAhead", () => {
  it("picks reviews due in the next N days after today, soonest first", () => {
    const due = (d: number) =>
      makeCard({ queue: "review", state: "review", reps: 1, due: END + d * DAY });
    const today = makeCard({ queue: "review", state: "review", reps: 1, due: NOW });
    const tomorrow = due(0.5);
    const inThree = due(2.5);
    const later = due(5);
    expect(reviewAhead([later, inThree, today, tomorrow], END, 3)).toEqual([
      tomorrow.id,
      inThree.id,
    ]);
  });
});

describe("customQueue", () => {
  it("goes through the chosen cards once, bringing back the ones relearning soon", () => {
    const a = makeCard();
    const b = makeCard();
    const c = makeCard();
    const relearning = {
      ...b,
      queue: "relearning" as const,
      state: "relearning" as const,
      due: NOW + 60_000,
      reps: 1,
    };
    const cards = [a, relearning, c];
    expect(customQueue([a.id, b.id, c.id], cards, new Set([b.id]), NOW)).toEqual([
      a.id,
      c.id,
      b.id,
    ]);
    const laterRelearning = { ...relearning, due: NOW + 3_600_000 };
    expect(customQueue([a.id, b.id, c.id], [a, laterRelearning, c], new Set([b.id]), NOW)).toEqual([
      a.id,
      c.id,
    ]);
    expect(customQueue([a.id], [{ ...a, queue: "suspended" }], new Set(), NOW)).toEqual([]);
  });
});
