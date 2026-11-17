import { describe, expect, it } from "vitest";
import { FACTORY_NOW, makeCard } from "../../../tests/factories";
import { newCard, nextClozeNumber, parseTags, plainText, planCardChanges } from "./index";

describe("plainText", () => {
  it.each([
    ["<b>cat</b>", "cat"],
    ["a<br>b", "a b"],
    ["<div>a</div><div>b</div>", "a b"],
    ["  a \n\t b  ", "a b"],
    ["&lt;tag&gt; &amp; &quot;q&quot; &#39;s&#39; a&nbsp;b", "<tag> & \"q\" 's' a b"],
    ['<img src="x.png">', ""],
    ["\\(\\frac{1}{2}\\)", "\\(\\frac{1}{2}\\)"],
  ])("%j → %j", (html, expected) => {
    expect(plainText(html)).toBe(expected);
  });
});

describe("parseTags", () => {
  it("splits on spaces and commas, lowercases and removes duplicates", () => {
    expect(parseTags("  Verbos, inglês::Phrasal  verbos ÁGUA ")).toEqual([
      "verbos",
      "inglês::phrasal",
      "água",
    ]);
  });

  it("returns no tags for blank input", () => {
    expect(parseTags(" , ")).toEqual([]);
  });
});

describe("nextClozeNumber", () => {
  it("is one more than the highest cloze number in any field", () => {
    expect(nextClozeNumber(["{{c1::a}} {{c3::b}}", "{{c2::c}}"])).toBe(4);
  });

  it("starts at 1", () => {
    expect(nextClozeNumber(["no clozes", ""])).toBe(1);
  });
});

describe("planCardChanges", () => {
  const removed = { deletedAt: FACTORY_NOW + 1, updatedAt: FACTORY_NOW + 1 };

  it("creates cards for newly generated templates", () => {
    const c0 = makeCard({ templateOrd: 0 });
    expect(planCardChanges([0, 1, 2], [c0])).toEqual({ create: [1, 2], restore: [], remove: [] });
  });

  it("removes active cards that are no longer generated", () => {
    const c0 = makeCard({ templateOrd: 0 });
    const c1 = makeCard({ templateOrd: 1 });
    expect(planCardChanges([1], [c0, c1])).toEqual({ create: [], restore: [], remove: [c0.id] });
  });

  it("restores a removed card instead of creating a new one, keeping its history", () => {
    const old = makeCard({ templateOrd: 1, ...removed, reps: 3 });
    expect(planCardChanges([1], [old])).toEqual({ create: [], restore: [old.id], remove: [] });
  });

  it("restores only one card per template", () => {
    const a = makeCard({ templateOrd: 1, ...removed });
    const b = makeCard({ templateOrd: 1, ...removed });
    expect(planCardChanges([1], [a, b]).restore).toEqual([a.id]);
  });

  it("leaves already-removed cards alone", () => {
    const gone = makeCard({ templateOrd: 1, ...removed });
    expect(planCardChanges([], [gone])).toEqual({ create: [], restore: [], remove: [] });
  });
});

describe("newCard", () => {
  it("is a new card positioned by its creation time", () => {
    expect(newCard({ id: "c", noteId: "n", deckId: "d", templateOrd: 2, now: 1_000 })).toEqual({
      id: "c",
      noteId: "n",
      deckId: "d",
      templateOrd: 2,
      queue: "new",
      state: "new",
      buriedUntilDay: null,
      newPosition: 1_000,
      due: 1_000,
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      learningStep: 0,
      reps: 0,
      lapses: 0,
      lastReviewAt: null,
      flag: 0,
      createdAt: 1_000,
      updatedAt: 1_000,
      deletedAt: null,
    });
  });
});
