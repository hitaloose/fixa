import { beforeEach, describe, expect, it } from "vitest";
import { makeCard, makeDeck, makePreset } from "../../../../tests/factories";
import type { Deck, Preset } from "../../../domain/model";
import { buildDeckOverview, type DeckOverviewInput } from "./deckOverview";

const SP = "America/Sao_Paulo";
const NOW = Date.parse("2026-11-16T15:00:00Z");
const DAY = 86_400_000;

let preset: Preset;
let ingles: Deck;
let phrasal: Deck;
let idioms: Deck;

beforeEach(() => {
  preset = makePreset();
  ingles = makeDeck({ name: "Inglês", presetId: preset.id });
  phrasal = makeDeck({ name: "Phrasal", parentId: ingles.id, presetId: preset.id });
  idioms = makeDeck({ name: "Idioms", parentId: ingles.id, presetId: preset.id });
});

const review = (deckId: string, due: number) =>
  makeCard({ deckId, queue: "review", state: "review", due, reps: 2 });

function input(over: Partial<DeckOverviewInput> = {}): DeckOverviewInput {
  return {
    decks: [ingles, phrasal, idioms],
    presets: [preset],
    cards: [],
    deckCards: [],
    logsToday: [],
    recentLogs: [],
    now: NOW,
    cutoffHour: 4,
    timeZone: SP,
    ...over,
  };
}

describe("buildDeckOverview", () => {
  it("returns null for an unknown deck", () => {
    expect(buildDeckOverview("00000000-0000-7000-b000-0000000000ff", input())).toBeNull();
  });

  it("shows the deck with its path, today's counts and estimate", () => {
    const cards = [review(phrasal.id, NOW - 1), makeCard({ deckId: idioms.id })];
    const overview = buildDeckOverview(phrasal.id, input({ cards }));
    expect(overview).toMatchObject({
      deck: phrasal,
      path: "Inglês::Phrasal",
      counts: { new: 0, learning: 0, review: 1 },
      minutes: 1,
    });
  });

  it("lists direct subdecks, sorted, with their counts", () => {
    const cards = [review(phrasal.id, NOW - 1)];
    const overview = buildDeckOverview(ingles.id, input({ cards }));
    expect(overview?.subdecks.map((s) => [s.deck.name, s.counts.review])).toEqual([
      ["Idioms", 0],
      ["Phrasal", 1],
    ]);
  });

  it("forecasts the next 7 days from the deck's and subdecks' cards", () => {
    const deckCards = [
      review(phrasal.id, NOW + DAY),
      review(idioms.id, NOW + DAY),
      review(ingles.id, NOW - DAY),
    ];
    const forecast = buildDeckOverview(ingles.id, input({ deckCards }))?.forecast;
    expect(forecast?.slice(0, 2)).toEqual([
      { day: "2026-11-16", count: 1 },
      { day: "2026-11-17", count: 2 },
    ]);
    expect(forecast).toHaveLength(7);
  });
});
