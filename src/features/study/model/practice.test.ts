import { describe, expect, it } from "vitest";
import { makeCard } from "../../../../tests/factories";
import {
  answerPractice,
  removeFromPractice,
  restoreToPractice,
  startPractice,
  undoPractice,
} from "./practice";

/** random() = 0 always picks the first candidate of the draw. */
const first = () => 0;

const cards = () => [makeCard(), makeCard(), makeCard({ queue: "suspended" }), makeCard()];

describe("startPractice", () => {
  it("deals from the studyable cards, with nothing practised yet", () => {
    const all = cards();
    const data = startPractice(all, first);
    expect(data.pool).toEqual([all[0]?.id, all[1]?.id, all[3]?.id]);
    expect(data.currentId).toBe(all[0]?.id);
    expect(data.answered).toBe(0);
  });

  it("has no current card when nothing is studyable", () => {
    expect(startPractice([makeCard({ queue: "suspended" })], first).currentId).toBe(null);
  });
});

describe("answerPractice", () => {
  it("counts the answer, remembers the rating and moves to another card", () => {
    const all = cards();
    const start = startPractice(all, first);
    const after = answerPractice(start, 1, first);
    expect(after.answered).toBe(1);
    expect(after.lastRating).toEqual({ [start.currentId as string]: 1 });
    expect(after.currentId).toBe(all[1]?.id);
  });

  it("does nothing when there is no current card", () => {
    const empty = startPractice([], first);
    expect(answerPractice(empty, 3, first)).toEqual(empty);
  });
});

describe("undoPractice", () => {
  it("brings back the previous card and its rating from before", () => {
    const start = startPractice(cards(), first);
    const once = answerPractice(start, 3, first);
    const twice = answerPractice(once, 1, first);
    const undone = undoPractice(twice);
    expect(undone.currentId).toBe(once.currentId);
    expect(undone.answered).toBe(1);
    expect(undone.lastRating).toEqual(once.lastRating);
    expect(undoPractice(undone)).toEqual({ ...start, history: [] });
  });

  it("does nothing without a previous answer", () => {
    const start = startPractice(cards(), first);
    expect(undoPractice(start)).toEqual(start);
  });

  it("keeps at most 20 answers to undo", () => {
    let data = startPractice(cards(), first);
    for (let i = 0; i < 25; i++) data = answerPractice(data, 3, first);
    expect(data.history).toHaveLength(20);
  });
});

describe("removeFromPractice / restoreToPractice", () => {
  it("takes a buried or suspended card out of the pool and deals another", () => {
    const all = cards();
    const start = startPractice(all, first);
    const removed = removeFromPractice(start, all[0]?.id as string, first);
    expect(removed.pool).not.toContain(all[0]?.id);
    expect(removed.currentId).toBe(all[1]?.id);
  });

  it("forgets undo entries of the removed card", () => {
    const all = cards();
    const answered = answerPractice(startPractice(all, first), 3, first);
    const removed = removeFromPractice(answered, all[0]?.id as string, first);
    expect(removed.history).toEqual([]);
  });

  it("keeps the current card when another one is removed", () => {
    const all = cards();
    const start = startPractice(all, first);
    expect(removeFromPractice(start, all[3]?.id as string, first).currentId).toBe(all[0]?.id);
  });

  it("puts a card back and shows it again (undoing a bury)", () => {
    const all = cards();
    const removed = removeFromPractice(startPractice(all, first), all[0]?.id as string, first);
    const restored = restoreToPractice(removed, all[0]?.id as string);
    expect(restored.pool).toContain(all[0]?.id);
    expect(restored.currentId).toBe(all[0]?.id);
    expect(restoreToPractice(restored, all[0]?.id as string).pool).toEqual(restored.pool);
  });
});
