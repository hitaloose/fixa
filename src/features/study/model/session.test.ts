import { beforeEach, describe, expect, it } from "vitest";
import { makeCard, makeDeck, makePreset } from "../../../../tests/factories";
import type { Card, Deck, Preset } from "../../../domain/model";
import { LEARN_AHEAD_MS } from "../../../domain/queue";
import { answerCard, replaceCard, type SessionData, undoAnswer, upNext } from "./session";

const TZ = "America/Sao_Paulo";
const NOW = Date.parse("2026-11-16T15:00:00Z"); // 12:00 in São Paulo
const MIN = 60_000;

let preset: Preset;
let deck: Deck;
let data: SessionData;

function session(cards: Card[], overrides: Partial<SessionData> = {}): SessionData {
  return {
    rootDeckId: deck.id,
    decks: [deck],
    presets: [preset],
    cards,
    logsToday: [],
    cutoffHour: 4,
    timeZone: TZ,
    pinnedId: null,
    ...overrides,
  };
}

beforeEach(() => {
  preset = makePreset({ learningSteps: ["1m", "10m"], newPerDay: 20 });
  deck = makeDeck({ presetId: preset.id });
  data = session([]);
});

const newCard = (o: Partial<Card> = {}) => makeCard({ deckId: deck.id, due: NOW - MIN, ...o });

describe("upNext", () => {
  it("shows the first card of the queue with today's counts", () => {
    const a = newCard({ newPosition: 1 });
    const b = newCard({ newPosition: 2 });
    const next = upNext(session([b, a]), NOW);
    expect(next.card?.id).toBe(a.id);
    expect(next.counts).toEqual({ new: 2, learning: 0, review: 0 });
    expect(next.waitUntil).toBeNull();
  });

  it("waits for a learning card due later today", () => {
    const later = newCard({
      queue: "learning",
      state: "learning",
      due: NOW + LEARN_AHEAD_MS + 5 * MIN,
      reps: 1,
    });
    const next = upNext(session([later]), NOW);
    expect(next.card).toBeNull();
    expect(next.waitUntil).toBe(later.due - LEARN_AHEAD_MS);
  });

  it("has nothing to wait for when all is done", () => {
    expect(upNext(session([]), NOW)).toEqual({
      card: null,
      counts: { new: 0, learning: 0, review: 0 },
      waitUntil: null,
    });
  });

  it("shows a pinned card first while it is still in the queue", () => {
    const a = newCard({ newPosition: 1 });
    const b = newCard({ newPosition: 2 });
    expect(upNext(session([a, b], { pinnedId: b.id }), NOW).card?.id).toBe(b.id);
    const buried = { ...b, queue: "buried" as const, buriedUntilDay: "2026-11-17" };
    expect(upNext(session([a, buried], { pinnedId: b.id }), NOW).card?.id).toBe(a.id);
  });
});

describe("answerCard", () => {
  it("schedules the card, logs the answer and moves on", () => {
    const a = newCard({ newPosition: 1 });
    const b = newCard({ newPosition: 2 });
    const { data: after, change } = answerCard(session([a, b]), {
      cardId: a.id,
      rating: 3,
      now: NOW,
      durationMs: 5_000,
      logId: "00000000-0000-7000-8000-00000000f001",
    });
    expect(change.before).toEqual(a);
    expect(change.card).toMatchObject({ id: a.id, queue: "learning", reps: 1 });
    expect(change.log).toMatchObject({
      cardId: a.id,
      rating: 3,
      durationMs: 5_000,
      stateBefore: "new",
    });
    expect(after.logsToday).toEqual([change.log]);
    expect(after.cards.find((c) => c.id === a.id)).toEqual(change.card);
    const next = upNext(after, NOW);
    expect(next.card?.id).toBe(b.id);
    expect(next.counts).toEqual({ new: 1, learning: 1, review: 0 });
  });

  it("buries siblings according to the preset", () => {
    const a = newCard({ noteId: "00000000-0000-7000-8000-00000000aaaa" });
    const sibling = newCard({ noteId: a.noteId, templateOrd: 1 });
    const { data: after, change } = answerCard(session([a, sibling]), {
      cardId: a.id,
      rating: 3,
      now: NOW,
      durationMs: 0,
      logId: "00000000-0000-7000-8000-00000000f001",
    });
    expect(change.buriedBefore).toEqual([sibling]);
    expect(change.buried).toEqual([
      { ...sibling, queue: "buried", buriedUntilDay: "2026-11-17", updatedAt: NOW },
    ]);
    expect(after.cards.find((c) => c.id === sibling.id)?.queue).toBe("buried");
  });

  it("reports a leech", () => {
    const leechy = makePreset({ id: preset.id, leechThreshold: 1, leechAction: "suspend" });
    const review = newCard({
      queue: "review",
      state: "review",
      reps: 5,
      stability: 10,
      difficulty: 5,
      lastReviewAt: NOW - 10 * 86_400_000,
      scheduledDays: 10,
    });
    const { change } = answerCard(session([review], { presets: [leechy] }), {
      cardId: review.id,
      rating: 1,
      now: NOW,
      durationMs: 0,
      logId: "00000000-0000-7000-8000-00000000f001",
    });
    expect(change.leech).toBe("suspend");
    expect(change.card.queue).toBe("suspended");
  });

  it("clears the pinned card once it is answered", () => {
    const a = newCard();
    const { data: after } = answerCard(session([a], { pinnedId: a.id }), {
      cardId: a.id,
      rating: 3,
      now: NOW,
      durationMs: 0,
      logId: "00000000-0000-7000-8000-00000000f001",
    });
    expect(after.pinnedId).toBeNull();
  });

  it("rejects an unknown card", () => {
    expect(() =>
      answerCard(data, { cardId: "nope", rating: 3, now: NOW, durationMs: 0, logId: "x" }),
    ).toThrow("card nope is not in this session");
  });
});

describe("undoAnswer", () => {
  it("restores the card and its siblings, uncounts the log and shows the card again", () => {
    const a = newCard({ noteId: "00000000-0000-7000-8000-00000000aaaa", newPosition: 2 });
    const sibling = newCard({ noteId: a.noteId, templateOrd: 1, newPosition: 2 });
    const other = newCard({ newPosition: 1 });
    const before = session([a, sibling, other]);
    const { data: answered, change } = answerCard(before, {
      cardId: a.id,
      rating: 3,
      now: NOW,
      durationMs: 0,
      logId: "00000000-0000-7000-8000-00000000f001",
    });
    const undone = undoAnswer(answered, change, NOW + 1);
    expect(undone.cards).toEqual(before.cards);
    expect(undone.logsToday).toEqual([{ ...change.log, undoneAt: NOW + 1 }]);
    const next = upNext(undone, NOW + 1);
    expect(next.card?.id).toBe(a.id);
    expect(next.counts).toEqual({ new: 3, learning: 0, review: 0 });
  });
});

describe("replaceCard", () => {
  it("updates a card (e.g. buried or suspended from the study screen)", () => {
    const a = newCard();
    const suspended = { ...a, queue: "suspended" as const };
    const after = replaceCard(session([a], { pinnedId: a.id }), suspended);
    expect(after.cards).toEqual([suspended]);
    expect(upNext(after, NOW).card).toBeNull();
  });
});
