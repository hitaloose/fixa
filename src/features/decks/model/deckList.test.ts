import { beforeEach, describe, expect, it } from "vitest";
import { makeCard, makeDeck, makePreset, makeReviewLog } from "../../../../tests/factories";
import type { Deck, Preset } from "../../../domain/model";
import { buildDeckList, type DeckListInput } from "./deckList";

const SP = "America/Sao_Paulo";
const NOW = Date.parse("2026-11-16T15:00:00Z"); // 12:00 local
const START = Date.parse("2026-11-16T07:00:00Z"); // 04:00 local

let preset: Preset;
let ingles: Deck;
let phrasal: Deck;
let math: Deck;

beforeEach(() => {
  preset = makePreset({ newPerDay: 2 });
  ingles = makeDeck({ name: "Inglês", presetId: preset.id });
  phrasal = makeDeck({ name: "Phrasal", parentId: ingles.id, presetId: preset.id });
  math = makeDeck({ name: "Matemática", presetId: preset.id });
});

function input(over: Partial<DeckListInput> = {}): DeckListInput {
  return {
    decks: [ingles, phrasal, math],
    presets: [preset],
    cards: [],
    logsToday: [],
    recentLogs: [],
    now: NOW,
    cutoffHour: 4,
    timeZone: SP,
    query: "",
    ...over,
  };
}

const review = (deckId: string) =>
  makeCard({ deckId, queue: "review", state: "review", due: NOW - 1_000, reps: 2 });

describe("buildDeckList", () => {
  it("lists visible decks depth-first with today's counts (subdecks included)", () => {
    const cards = [makeCard({ deckId: phrasal.id }), review(phrasal.id), review(math.id)];
    const { rows } = buildDeckList(input({ cards }));
    expect(rows.map((r) => [r.node.path, r.counts])).toEqual([
      ["Inglês", { new: 1, learning: 0, review: 1 }],
      ["Inglês::Phrasal", { new: 1, learning: 0, review: 1 }],
      ["Matemática", { new: 0, learning: 0, review: 1 }],
    ]);
  });

  it("marks which decks have subdecks", () => {
    const { rows } = buildDeckList(input());
    expect(rows.map((r) => r.hasChildren)).toEqual([true, false, false]);
  });

  it("applies daily limits, discounting what was done today", () => {
    const cards = Array.from({ length: 5 }, (_, i) =>
      makeCard({ deckId: math.id, newPosition: i }),
    );
    const logsToday = [
      makeReviewLog({ cardId: cards[0]?.id ?? "", stateBefore: "new", reviewedAt: START + 1 }),
    ];
    const { rows } = buildDeckList(input({ cards, logsToday }));
    expect(rows.find((r) => r.node.deck.id === math.id)?.counts.new).toBe(1);
  });

  it("hides children of collapsed decks", () => {
    const { rows } = buildDeckList(
      input({ decks: [{ ...ingles, collapsed: true }, phrasal, math] }),
    );
    expect(rows.map((r) => r.node.path)).toEqual(["Inglês", "Matemática"]);
  });

  it("filters by the search query", () => {
    const { rows } = buildDeckList(input({ query: "phra" }));
    expect(rows.map((r) => r.node.path)).toEqual(["Inglês", "Inglês::Phrasal"]);
  });

  it("summarises today across top-level decks, with an estimate from recent answer times", () => {
    const cards = [review(phrasal.id), review(math.id), makeCard({ deckId: math.id })];
    const recentLogs = [makeReviewLog({ durationMs: 30_000 })];
    expect(buildDeckList(input({ cards, recentLogs })).summary).toEqual({
      counts: { new: 1, learning: 0, review: 2 },
      minutes: 2,
    });
  });

  it("summarises all decks even while searching", () => {
    const cards = [review(math.id)];
    expect(buildDeckList(input({ cards, query: "phra" })).summary.counts.review).toBe(1);
  });
});
