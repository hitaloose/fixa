import { describe, expect, it } from "vitest";
import {
  FACTORY_NOW,
  makeCard,
  makeDeck,
  makeNote,
  makeNoteType,
  makePreset,
  makeReviewLog,
} from "../../../../tests/factories";
import { parseAnkiCollection, planAnkiImport } from "../../import/anki";
import type { Card, Deck, Note, NoteType, Preset, ReviewLog } from "../../model";
import { buildAnkiExport } from "./index";

const DAY = 86_400_000;
const NOW = FACTORY_NOW + 100 * DAY;

function sample() {
  const preset = makePreset({
    name: "Intenso",
    learningSteps: ["5m", "1h", "1d"],
    relearningSteps: ["10m"],
    newPerDay: 50,
    leechAction: "suspend",
  });
  const parent = makeDeck({ name: "Inglês", presetId: preset.id });
  const child = makeDeck({
    name: "Animais",
    parentId: parent.id,
    presetId: preset.id,
    collapsed: true,
  });
  const noteType = makeNoteType({ css: ".card { color: red; }" });
  const cat = makeNote({
    noteTypeId: noteType.id,
    fields: {
      front: "cat",
      back: 'gato <img src="abc.png"> <audio controls="" src="def.mp3"></audio>',
    },
    sortField: "cat",
    tags: ["animais"],
    guid: "Gk8&cat",
  });
  const dog = makeNote({
    noteTypeId: noteType.id,
    fields: { front: "dog", back: "cão" },
    sortField: "dog",
  });
  const review: Card = makeCard({
    noteId: cat.id,
    deckId: child.id,
    queue: "review",
    state: "review",
    due: NOW + 3 * DAY,
    scheduledDays: 10,
    stability: 12.5,
    difficulty: 6.25,
    reps: 5,
    lapses: 1,
    lastReviewAt: NOW - 7 * DAY,
    flag: 2,
  });
  const fresh: Card = makeCard({ noteId: dog.id, deckId: parent.id, newPosition: 7 });
  const suspended: Card = makeCard({
    noteId: dog.id,
    deckId: parent.id,
    templateOrd: 1,
    queue: "suspended",
    state: "review",
    due: NOW,
    scheduledDays: 4,
    stability: 4,
    difficulty: 5,
    reps: 2,
    lastReviewAt: NOW - 4 * DAY,
  });
  const logs: ReviewLog[] = [
    makeReviewLog({
      cardId: review.id,
      reviewedAt: NOW - 30 * DAY,
      rating: 3,
      stateBefore: "new",
      durationMs: 8000,
    }),
    makeReviewLog({
      cardId: review.id,
      reviewedAt: NOW - 7 * DAY,
      rating: 4,
      stateBefore: "review",
      durationMs: 4000,
      scheduledDays: 10,
    }),
    makeReviewLog({
      cardId: review.id,
      reviewedAt: NOW - 6 * DAY,
      rating: 1,
      undoneAt: NOW - 6 * DAY,
    }),
    makeReviewLog({ cardId: review.id, reviewedAt: NOW - 5 * DAY, kind: "reschedule" }),
  ];
  return {
    preset,
    decks: [parent, child],
    noteTypes: [noteType],
    notes: [cat, dog],
    cards: [review, fresh, suspended],
    logs,
  };
}

function exported(s = sample()) {
  return buildAnkiExport({
    decks: s.decks as Deck[],
    presets: [s.preset] as Preset[],
    noteTypes: s.noteTypes as NoteType[],
    notes: s.notes as Note[],
    cards: s.cards,
    reviewLogs: s.logs,
    now: NOW,
  });
}

describe("buildAnkiExport", () => {
  it("writes the legacy collection JSON: note types, decks with :: paths and options in minutes", () => {
    const out = exported();
    const models = Object.values(JSON.parse(out.col.models)) as Array<Record<string, unknown>>;
    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      name: "Básico",
      type: 0,
      css: ".card { color: red; }",
      flds: [
        expect.objectContaining({ name: "Frente", ord: 0 }),
        expect.objectContaining({ name: "Verso", ord: 1 }),
      ],
      tmpls: [expect.objectContaining({ name: "Cartão 1", ord: 0, qfmt: "{{Frente}}" })],
    });
    const decks = Object.values(JSON.parse(out.col.decks)) as Array<{
      name: string;
      collapsed: boolean;
      id: number;
    }>;
    expect(decks.map((d) => d.name).sort()).toEqual(["Default", "Inglês", "Inglês::Animais"]);
    expect(decks.find((d) => d.name === "Default")?.id).toBe(1);
    const dconf = Object.values(JSON.parse(out.col.dconf)) as Array<Record<string, unknown>>;
    expect(dconf.find((d) => d.name === "Intenso")).toMatchObject({
      new: { perDay: 50, delays: [5, 60, 1440] },
      lapse: { delays: [10], leechAction: 0 },
    });
  });

  it("writes notes with \\x1f-separated fields, tags, guid and Anki media syntax", () => {
    const out = exported();
    const cat = out.notes.find((n) => n.guid === "Gk8&cat");
    expect(cat?.flds).toBe('cat\x1fgato <img src="abc.png"> [sound:def.mp3]');
    expect(cat?.tags).toBe(" animais ");
    expect(cat?.sfld).toBe("cat");
    const dog = out.notes.find((n) => n.flds.startsWith("dog"));
    expect(dog?.guid).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(out.media).toEqual(["abc.png", "def.mp3"]);
  });

  it("writes cards in Anki's queue/type/due encoding with FSRS memory in data", () => {
    const out = exported();
    const crt = out.col.crt;
    const review = out.cards.find((c) => c.type === 2 && c.queue === 2);
    expect(review).toMatchObject({ ivl: 10, reps: 5, lapses: 1, flags: 2 });
    expect(review?.due).toBe(Math.floor((NOW + 3 * DAY - crt * 1000) / DAY));
    expect(JSON.parse(review?.data ?? "{}")).toEqual({ s: 12.5, d: 6.25 });
    expect(out.cards.find((c) => c.type === 0)).toMatchObject({ queue: 0, data: "" });
    expect(out.cards.find((c) => c.queue === -1)).toMatchObject({ type: 2 });
  });

  it("exports only answers that were not undone", () => {
    const out = exported();
    expect(out.revlog.map((l) => [l.ease, l.type, l.time])).toEqual([
      [3, 0, 8000],
      [4, 1, 4000],
    ]);
  });

  it("round-trips through the Anki importer", () => {
    const s = sample();
    const out = exported(s);
    const plan = planAnkiImport(parseAnkiCollection(JSON.parse(JSON.stringify(out))), {
      now: NOW,
      ids: {
        next: (() => {
          let n = 0;
          return () => `00000000-0000-7000-9000-${(++n).toString(16).padStart(12, "0")}`;
        })(),
      },
      defaultPresetId: "00000000-0000-7000-a000-000000000001",
      existingDecks: [],
      existingPresets: [],
      existingNoteTypes: [],
      existingGuids: new Set(),
      mediaNames: new Map([
        ["abc.png", "abc.png"],
        ["def.mp3", "def.mp3"],
      ]),
    });
    expect(plan.decks.map((d) => d.name).sort()).toEqual(["Animais", "Inglês"]);
    // `controls` and `controls=""` are the same boolean attribute in HTML.
    const html = (fields: Record<string, string>) =>
      Object.values(fields).map((v) => v.replaceAll('controls=""', "controls"));
    expect(plan.notes.map((n) => html(n.fields)).sort()).toEqual(
      s.notes.map((n) => html(n.fields)).sort(),
    );
    const byState = (cards: Card[]) =>
      cards.map((c) => [c.queue, c.state, c.reps, c.flag, c.scheduledDays]).sort();
    expect(byState(plan.cards)).toEqual(byState(s.cards));
    const review = plan.cards.find((c) => c.queue === "review");
    expect(review).toMatchObject({ stability: 12.5, difficulty: 6.25 });
    expect(Math.abs((review?.due ?? 0) - (NOW + 3 * DAY))).toBeLessThan(DAY);
    expect(plan.presets[0]).toMatchObject({
      name: "Intenso",
      learningSteps: ["5m", "1h", "1d"],
      newPerDay: 50,
    });
  });
});
