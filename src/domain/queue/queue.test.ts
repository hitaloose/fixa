import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import { FACTORY_NOW, makeCard, makeDeck, makePreset } from "../../../tests/factories";
import type { Card, Deck, Preset } from "../model";
import {
  buildQueue,
  burySiblings,
  type DoneToday,
  effectiveLimits,
  LEARN_AHEAD_MS,
  type QueueInput,
  releaseBuried,
} from "./index";

const MIN = 60_000;
const HOUR = 3_600_000;
const NOW = FACTORY_NOW;
const TODAY = "2026-11-16";
const END = NOW + 12 * HOUR;

// Created per test: factories reset their sequential IDs before each test.
let preset: Preset;
let root: Deck;
beforeEach(() => {
  preset = makePreset();
  root = makeDeck({ name: "Raiz", presetId: preset.id });
});

function input(cards: Card[], over: Partial<QueueInput> = {}): QueueInput {
  return {
    rootDeckId: root.id,
    decks: [root],
    presets: [preset],
    cards,
    now: NOW,
    today: TODAY,
    endOfDay: END,
    doneToday: {},
    seed: "seed",
    ...over,
  };
}

const newCard = (o: Partial<Card> = {}) => makeCard({ deckId: root.id, ...o });
const reviewCard = (o: Partial<Card> = {}) =>
  makeCard({ deckId: root.id, queue: "review", state: "review", due: NOW - HOUR, reps: 3, ...o });
const learningCard = (o: Partial<Card> = {}) =>
  makeCard({ deckId: root.id, queue: "learning", state: "learning", due: NOW, reps: 1, ...o });
const ids = (cards: Card[]) => cards.map((c) => c.id);

describe("effectiveLimits", () => {
  it("uses the preset by default", () => {
    expect(effectiveLimits(root, preset, TODAY)).toEqual({ newPerDay: 20, reviewsPerDay: 200 });
  });

  it("lets per-deck overrides beat the preset, field by field", () => {
    const deck = makeDeck({ presetId: preset.id, overrides: { newPerDay: 5 } });
    expect(effectiveLimits(deck, preset, TODAY)).toEqual({ newPerDay: 5, reviewsPerDay: 200 });
  });

  it("lets today-only overrides beat per-deck overrides on that day", () => {
    const deck = makeDeck({
      presetId: preset.id,
      overrides: { newPerDay: 5, reviewsPerDay: 50, todayOnly: { day: TODAY, newPerDay: 0 } },
    });
    expect(effectiveLimits(deck, preset, TODAY)).toEqual({ newPerDay: 0, reviewsPerDay: 50 });
  });

  it("ignores today-only overrides from another day", () => {
    const deck = makeDeck({
      presetId: preset.id,
      overrides: { todayOnly: { day: "2026-11-15", newPerDay: 0 } },
    });
    expect(effectiveLimits(deck, preset, TODAY)).toEqual({ newPerDay: 20, reviewsPerDay: 200 });
  });
});

describe("buildQueue — what is due", () => {
  it("puts learning cards due within the learn-ahead window first, by due time", () => {
    const later = learningCard({ due: NOW + 10 * MIN });
    const sooner = learningCard({ due: NOW - MIN });
    const review = reviewCard();
    const q = buildQueue(input([review, later, sooner]));
    expect(ids(q.cards)).toEqual([sooner.id, later.id, review.id]);
  });

  it("learns ahead 20 minutes", () => {
    expect(LEARN_AHEAD_MS).toBe(20 * MIN);
    const edge = learningCard({ due: NOW + 20 * MIN });
    const beyond = learningCard({ due: NOW + 20 * MIN + 1 });
    expect(ids(buildQueue(input([edge, beyond])).cards)).toEqual([edge.id]);
  });

  it("counts learning cards due later today but not those due tomorrow", () => {
    const laterToday = learningCard({ due: NOW + 2 * HOUR });
    const tomorrow = learningCard({ due: END });
    const q = buildQueue(input([laterToday, tomorrow]));
    expect(q.cards).toEqual([]);
    expect(q.counts.learning).toBe(1);
  });

  it("treats relearning cards as learning", () => {
    const relearning = learningCard({ queue: "relearning", state: "relearning" });
    const q = buildQueue(input([relearning]));
    expect(ids(q.cards)).toEqual([relearning.id]);
    expect(q.counts).toEqual({ new: 0, learning: 1, review: 0 });
  });

  it("includes reviews due before the end of the study day only", () => {
    const due = reviewCard({ due: END - 1 });
    const notYet = reviewCard({ due: END });
    expect(ids(buildQueue(input([due, notYet])).cards)).toEqual([due.id]);
  });

  it("never includes suspended, buried-today or deleted cards", () => {
    const cards = [
      reviewCard({ queue: "suspended" }),
      reviewCard({ queue: "buried", buriedUntilDay: "2026-11-17" }),
      reviewCard({ deletedAt: NOW }),
      newCard({ deletedAt: NOW }),
    ];
    expect(buildQueue(input(cards)).cards).toEqual([]);
  });

  it("brings back cards buried until today or earlier", () => {
    const back = reviewCard({ queue: "buried", buriedUntilDay: TODAY });
    const old = newCard({ queue: "buried", buriedUntilDay: "2026-11-01" });
    expect(ids(buildQueue(input([back, old])).cards)).toEqual([back.id, old.id]);
  });

  it("includes subdecks and excludes other decks", () => {
    const child = makeDeck({ parentId: root.id, presetId: preset.id });
    const other = makeDeck({ presetId: preset.id });
    const inChild = reviewCard({ deckId: child.id });
    const inOther = reviewCard({ deckId: other.id });
    const q = buildQueue(input([inChild, inOther], { decks: [root, child, other] }));
    expect(ids(q.cards)).toEqual([inChild.id]);
  });
});

describe("buildQueue — daily limits", () => {
  it("limits reviews to the remaining daily allowance", () => {
    const p = makePreset({ reviewsPerDay: 5 });
    const deck = { ...root, presetId: p.id };
    const cards = Array.from({ length: 6 }, (_, i) => reviewCard({ due: NOW - i * MIN }));
    const q = buildQueue(
      input(cards, {
        decks: [deck],
        presets: [p],
        doneToday: { [root.id]: { newIntroduced: 0, reviewsDone: 3 } },
      }),
    );
    expect(q.counts.review).toBe(2);
  });

  it("limits new cards to the remaining daily allowance, never below zero", () => {
    const p = makePreset({ newPerDay: 3 });
    const deck = { ...root, presetId: p.id };
    const cards = Array.from({ length: 5 }, (_, i) => newCard({ newPosition: i }));
    const at = (newIntroduced: number) =>
      buildQueue(
        input(cards, {
          decks: [deck],
          presets: [p],
          doneToday: { [root.id]: { newIntroduced, reviewsDone: 0 } },
        }),
      ).counts.new;
    expect(at(0)).toBe(3);
    expect(at(2)).toBe(1);
    expect(at(7)).toBe(0);
  });

  it("does not let new cards exceed what is left of the review allowance", () => {
    const p = makePreset({ newPerDay: 10, reviewsPerDay: 4 });
    const deck = { ...root, presetId: p.id };
    const cards = [
      reviewCard(),
      reviewCard(),
      ...Array.from({ length: 5 }, (_, i) => newCard({ newPosition: i })),
    ];
    expect(buildQueue(input(cards, { decks: [deck], presets: [p] })).counts).toEqual({
      new: 2,
      learning: 0,
      review: 2,
    });
  });

  it("learning cards have no daily limit", () => {
    const p = makePreset({ newPerDay: 0, reviewsPerDay: 0 });
    const deck = { ...root, presetId: p.id };
    const cards = Array.from({ length: 3 }, () => learningCard());
    expect(buildQueue(input(cards, { decks: [deck], presets: [p] })).counts.learning).toBe(3);
  });

  it("a parent's limit caps the sum of its children", () => {
    const p3 = makePreset({ newPerDay: 3 });
    const parent = { ...root, presetId: p3.id };
    const a = makeDeck({ parentId: root.id, presetId: preset.id });
    const b = makeDeck({ parentId: root.id, presetId: preset.id });
    const cards = [a, b].flatMap((d) =>
      Array.from({ length: 4 }, (_, i) => newCard({ deckId: d.id, newPosition: i })),
    );
    const q = buildQueue(input(cards, { decks: [parent, a, b], presets: [p3, preset] }));
    expect(q.counts.new).toBe(3);
  });

  it("a child's own limit still applies when studying from the parent", () => {
    const p1 = makePreset({ newPerDay: 1 });
    const child = makeDeck({ parentId: root.id, presetId: p1.id });
    const cards = [
      ...Array.from({ length: 3 }, (_, i) => newCard({ deckId: child.id, newPosition: i })),
      newCard({ newPosition: 9 }),
    ];
    const q = buildQueue(input(cards, { decks: [root, child], presets: [preset, p1] }));
    expect(q.counts.new).toBe(2);
  });

  it("cards done today in a child count against the parent", () => {
    const p2 = makePreset({ newPerDay: 2 });
    const parent = { ...root, presetId: p2.id };
    const child = makeDeck({ parentId: root.id, presetId: preset.id });
    const cards = Array.from({ length: 3 }, (_, i) => newCard({ deckId: root.id, newPosition: i }));
    const doneToday: DoneToday = { [child.id]: { newIntroduced: 1, reviewsDone: 0 } };
    const q = buildQueue(
      input(cards, { decks: [parent, child], presets: [p2, preset], doneToday }),
    );
    expect(q.counts.new).toBe(1);
  });

  it("limits of decks above the studied deck do not apply", () => {
    const p0 = makePreset({ newPerDay: 0 });
    const top = makeDeck({ presetId: p0.id });
    const sub = { ...root, parentId: top.id };
    const q = buildQueue(input([newCard()], { decks: [top, sub], presets: [p0, preset] }));
    expect(q.counts.new).toBe(1);
  });
});

describe("buildQueue — order", () => {
  it("introduces new cards by newPosition (sequential)", () => {
    const c = [
      newCard({ newPosition: 2 }),
      newCard({ newPosition: 0 }),
      newCard({ newPosition: 1 }),
    ];
    expect(buildQueue(input(c)).cards.map((x) => x.newPosition)).toEqual([0, 1, 2]);
  });

  it("orders reviews by due date, oldest first", () => {
    const recent = reviewCard({ due: NOW - MIN });
    const overdue = reviewCard({ due: NOW - 3 * HOUR });
    expect(ids(buildQueue(input([recent, overdue])).cards)).toEqual([overdue.id, recent.id]);
  });

  it("orders reviews by deck when the preset asks for it", () => {
    const p = makePreset({ reviewOrder: "deck" });
    const parent = { ...root, presetId: p.id };
    const b = makeDeck({ name: "B", parentId: root.id, presetId: preset.id });
    const a = makeDeck({ name: "A", parentId: root.id, presetId: preset.id });
    const inB = reviewCard({ deckId: b.id, due: NOW - 3 * HOUR });
    const inA = reviewCard({ deckId: a.id, due: NOW - MIN });
    const q = buildQueue(input([inB, inA], { decks: [parent, b, a], presets: [p, preset] }));
    expect(ids(q.cards)).toEqual([inA.id, inB.id]);
  });

  it("deck order compares full paths from the studied deck down", () => {
    const p = makePreset({ reviewOrder: "deck" });
    const parent = { ...root, presetId: p.id };
    const a = makeDeck({ name: "A", parentId: root.id, presetId: preset.id });
    const aChild = makeDeck({ name: "B", parentId: a.id, presetId: preset.id });
    const ab = makeDeck({ name: "AB", parentId: root.id, presetId: preset.id });
    const z = makeDeck({ name: "Z", parentId: aChild.id, presetId: preset.id });
    const inAB = reviewCard({ deckId: ab.id, due: NOW - 3 * HOUR }); // Raiz::AB
    const inZ = reviewCard({ deckId: z.id, due: NOW - MIN }); // Raiz::A::B::Z sorts before Raiz::AB
    const q = buildQueue(
      input([inAB, inZ], { decks: [parent, a, aChild, ab, z], presets: [p, preset] }),
    );
    expect(ids(q.cards)).toEqual([inZ.id, inAB.id]);
  });

  it("due order ignores decks", () => {
    const b = makeDeck({ name: "B", parentId: root.id, presetId: preset.id });
    const a = makeDeck({ name: "A", parentId: root.id, presetId: preset.id });
    const inB = reviewCard({ deckId: b.id, due: NOW - 3 * HOUR });
    const inA = reviewCard({ deckId: a.id, due: NOW - MIN });
    expect(ids(buildQueue(input([inA, inB], { decks: [root, b, a] })).cards)).toEqual([
      inB.id,
      inA.id,
    ]);
  });

  it.each(["newCardOrder", "reviewOrder"] as const)(
    "random %s is a deterministic shuffle of the same cards, varying with the seed",
    (key) => {
      const p = makePreset({ [key]: "random", newPerDay: 100 } as Partial<Preset>);
      const deck = { ...root, presetId: p.id };
      const make =
        key === "newCardOrder"
          ? (i: number) => newCard({ newPosition: i })
          : (i: number) => reviewCard({ due: NOW - i * MIN });
      const cards = Array.from({ length: 30 }, (_, i) => make(i));
      const run = (seed: string) =>
        ids(buildQueue(input(cards, { decks: [deck], presets: [p], seed })).cards);
      expect(run("a")).toEqual(run("a"));
      expect(run("a")).not.toEqual(run("b"));
      expect([...run("a")].sort()).toEqual([...ids(cards)].sort());
    },
  );

  it("spreads new cards evenly between reviews", () => {
    const reviews = Array.from({ length: 4 }, (_, i) => reviewCard({ due: NOW - (10 - i) * MIN }));
    const news = [newCard({ newPosition: 0 }), newCard({ newPosition: 1 })];
    const kinds = buildQueue(input([...reviews, ...news])).cards.map((c) => c.queue);
    expect(kinds).toEqual(["review", "review", "new", "review", "review", "new"]);
  });

  it("with no reviews, only new cards; with no new cards, only reviews", () => {
    const news = [newCard({ newPosition: 0 }), newCard({ newPosition: 1 })];
    expect(buildQueue(input(news)).cards.map((c) => c.queue)).toEqual(["new", "new"]);
    expect(buildQueue(input([reviewCard()])).cards.map((c) => c.queue)).toEqual(["review"]);
  });

  it("more new cards than reviews still alternates as evenly as possible", () => {
    const kinds = buildQueue(
      input([reviewCard(), ...Array.from({ length: 3 }, (_, i) => newCard({ newPosition: i }))]),
    ).cards.map((c) => c.queue);
    expect(kinds).toEqual(["review", "new", "new", "new"]);
  });
});

describe("buildQueue — inconsistent input", () => {
  it("fails clearly when the studied deck is missing", () => {
    expect(() => buildQueue(input([], { decks: [] }))).toThrow(`deck ${root.id} not found`);
  });

  it("fails clearly when a deck's preset is missing", () => {
    expect(() => buildQueue(input([], { presets: [] }))).toThrow(`preset ${preset.id} not found`);
  });
});

describe("buildQueue — properties", () => {
  const cardArb = (decks: Deck[]) =>
    fc.record({
      kind: fc.constantFrom("new", "review", "learning", "suspended"),
      deck: fc.constantFrom(...decks),
      offset: fc.integer({ min: -48, max: 48 }),
      pos: fc.nat(100),
    });

  it("never exceeds any deck's limits, never duplicates, never leaves the subtree", () => {
    const child = makeDeck({ parentId: root.id, presetId: preset.id });
    const outside = makeDeck({ presetId: preset.id });
    fc.assert(
      fc.property(
        fc.array(cardArb([root, child, outside]), { maxLength: 60 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 10 }),
        (specs, newPerDay, reviewsPerDay, childNew) => {
          const p = makePreset({ newPerDay, reviewsPerDay });
          const pc = makePreset({ newPerDay: childNew });
          const decks = [{ ...root, presetId: p.id }, { ...child, presetId: pc.id }, outside];
          const cards = specs.map(({ kind, deck, offset, pos }) =>
            kind === "new"
              ? newCard({ deckId: deck.id, newPosition: pos })
              : kind === "suspended"
                ? reviewCard({ deckId: deck.id, queue: "suspended" })
                : kind === "review"
                  ? reviewCard({ deckId: deck.id, due: NOW + offset * HOUR })
                  : learningCard({ deckId: deck.id, due: NOW + offset * MIN }),
          );
          const q = buildQueue(input(cards, { decks, presets: [p, pc, preset] }));
          const taken = q.cards;
          expect(new Set(ids(taken)).size).toBe(taken.length);
          expect(taken.every((c) => c.deckId === root.id || c.deckId === child.id)).toBe(true);
          const newTaken = taken.filter((c) => c.queue === "new");
          const reviewTaken = taken.filter((c) => c.queue === "review");
          expect(newTaken.length).toBeLessThanOrEqual(newPerDay);
          expect(newTaken.length + reviewTaken.length).toBeLessThanOrEqual(reviewsPerDay);
          expect(newTaken.filter((c) => c.deckId === child.id).length).toBeLessThanOrEqual(
            childNew,
          );
          expect(taken.some((c) => c.queue === "suspended")).toBe(false);
        },
      ),
    );
  });
});

describe("burySiblings", () => {
  const note = "00000000-0000-7000-b000-0000000000c1";
  let answered: Card;
  beforeEach(() => {
    answered = reviewCard({ noteId: note });
  });

  it("buries new siblings until the next study day", () => {
    const sib = newCard({ noteId: note });
    expect(burySiblings(answered, [answered, sib], preset, TODAY, NOW)).toEqual([
      { ...sib, queue: "buried", buriedUntilDay: "2026-11-17", updatedAt: NOW },
    ]);
  });

  it("does not bury review siblings by default", () => {
    expect(burySiblings(answered, [reviewCard({ noteId: note })], preset, TODAY, NOW)).toEqual([]);
  });

  it("buries review siblings when the preset asks for it, keeping their FSRS state", () => {
    const p = makePreset({ buryReviewSiblings: true, buryNewSiblings: false });
    const rev = reviewCard({ noteId: note });
    const result = burySiblings(answered, [rev, newCard({ noteId: note })], p, TODAY, NOW);
    expect(result).toEqual([
      { ...rev, queue: "buried", buriedUntilDay: "2026-11-17", updatedAt: NOW },
    ]);
  });

  it("only buries siblings: never the answered card or other notes' cards", () => {
    const p = makePreset({ buryReviewSiblings: true });
    const strangers = [newCard(), reviewCard()];
    expect(burySiblings(answered, [answered, ...strangers], p, TODAY, NOW)).toEqual([]);
  });

  it("leaves suspended, learning and already-buried siblings alone", () => {
    const p = makePreset({ buryReviewSiblings: true });
    const sibs = [
      reviewCard({ noteId: note, queue: "suspended" }),
      learningCard({ noteId: note }),
      newCard({ noteId: note, queue: "buried", buriedUntilDay: "2026-11-17" }),
    ];
    expect(burySiblings(answered, sibs, p, TODAY, NOW)).toEqual([]);
  });

  it("ignores deleted siblings", () => {
    expect(
      burySiblings(answered, [newCard({ noteId: note, deletedAt: NOW })], preset, TODAY, NOW),
    ).toEqual([]);
  });
});

describe("releaseBuried", () => {
  it("returns cards buried until today or earlier to their FSRS queue", () => {
    const due = reviewCard({ queue: "buried", buriedUntilDay: TODAY });
    const still = newCard({ queue: "buried", buriedUntilDay: "2026-11-17" });
    const free = reviewCard();
    expect(releaseBuried([due, still, free], TODAY, NOW)).toEqual([
      { ...due, queue: "review", buriedUntilDay: null, updatedAt: NOW },
    ]);
  });
});
