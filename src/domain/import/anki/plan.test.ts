import { beforeEach, describe, expect, it } from "vitest";
import { makeDeck, makeNoteType, makePreset } from "../../../../tests/factories";
import type { Preset } from "../../model";
import {
  type AnkiCollection,
  type AnkiImportContext,
  parseAnkiCollection,
  planAnkiImport,
} from "./index";

const CRT = 1_700_000_000;
const DAY = 86_400;
const TODAY = 1_000;
const NOW_MS = (CRT + TODAY * DAY + 10 * 3600) * 1000;
const BASIC = 1_600_000_000_001;
const CLOZE = 1_600_000_000_002;
const D_INGLES = 1_700_000_000_101;
const D_ANIMAIS = 1_700_000_000_102;

function raw() {
  return {
    col: {
      crt: CRT,
      models: JSON.stringify({
        [BASIC]: {
          id: BASIC,
          name: "Basic",
          type: 0,
          css: ".card { color: red; }",
          flds: [
            { name: "Front", ord: 0, sticky: true, rtl: false },
            { name: "Back", ord: 1, sticky: false, rtl: false },
          ],
          tmpls: [
            {
              name: "Card 1",
              ord: 0,
              qfmt: "{{Front}}",
              afmt: "{{FrontSide}}<hr id=answer>{{Back}}",
            },
          ],
        },
        [CLOZE]: {
          id: CLOZE,
          name: "Cloze",
          type: 1,
          css: "",
          flds: [
            { name: "Text", ord: 0, sticky: false, rtl: false },
            { name: "Back Extra", ord: 1, sticky: false, rtl: false },
          ],
          tmpls: [
            {
              name: "Cloze",
              ord: 0,
              qfmt: "{{cloze:Text}}",
              afmt: "{{cloze:Text}}<br>{{Back Extra}}",
            },
          ],
        },
      }),
      decks: JSON.stringify({
        1: { id: 1, name: "Default", conf: 1, dyn: 0, collapsed: false },
        [D_INGLES]: { id: D_INGLES, name: "Inglês", conf: 1, dyn: 0, collapsed: false },
        [D_ANIMAIS]: { id: D_ANIMAIS, name: "Inglês::Animais", conf: 9, dyn: 0, collapsed: true },
        555: { id: 555, name: "Filtrado", dyn: 1 },
      }),
      dconf: JSON.stringify({
        1: {
          id: 1,
          name: "Default",
          new: { perDay: 20, delays: [1, 10] },
          rev: { perDay: 200, maxIvl: 36500 },
          lapse: { delays: [10], leechFails: 8, leechAction: 1 },
        },
        9: {
          id: 9,
          name: "Intenso",
          new: { perDay: 50, delays: [5, 30, 1440] },
          rev: { perDay: 500, maxIvl: 3650 },
          lapse: { delays: [15], leechFails: 6, leechAction: 0 },
          desiredRetention: 0.85,
        },
      }),
    },
    notes: [
      {
        id: 1_700_000_001_001,
        guid: "g-cat",
        mid: BASIC,
        mod: CRT + 100,
        tags: " animais Ingles ",
        flds: 'cat\x1fgato <img src="gato.png"> [sound:miau.mp3]',
      },
      {
        id: 1_700_000_001_002,
        guid: "g-dog",
        mid: BASIC,
        mod: CRT + 100,
        tags: "",
        flds: "dog\x1fcão",
      },
      {
        id: 1_700_000_001_003,
        guid: "g-brz",
        mid: CLOZE,
        mod: CRT + 100,
        tags: "geo",
        flds: "{{c1::Brasília}} é a capital\x1f",
      },
    ],
    cards: [
      // review card with history, in Animais
      {
        id: 1_700_000_002_001,
        nid: 1_700_000_001_001,
        did: D_ANIMAIS,
        ord: 0,
        mod: CRT + 200,
        type: 2,
        queue: 2,
        due: TODAY + 3,
        ivl: 10,
        factor: 2500,
        reps: 5,
        lapses: 1,
        left: 0,
        odid: 0,
        flags: 0,
        data: "",
      },
      // new card, position 2, sitting in a filtered deck (original deck Animais)
      {
        id: 1_700_000_002_002,
        nid: 1_700_000_001_002,
        did: 555,
        ord: 0,
        mod: CRT + 200,
        type: 0,
        queue: 0,
        due: 2,
        ivl: 0,
        factor: 0,
        reps: 0,
        lapses: 0,
        left: 0,
        odid: D_ANIMAIS,
        flags: 0,
        data: "",
      },
      // learning card due in seconds, flagged, 1 step left of 2 (Default preset: 1m 10m)
      {
        id: 1_700_000_002_003,
        nid: 1_700_000_001_003,
        did: D_INGLES,
        ord: 0,
        mod: CRT + 200,
        type: 1,
        queue: 1,
        due: NOW_MS / 1000 + 600,
        ivl: 0,
        factor: 2500,
        reps: 1,
        lapses: 0,
        left: 1001,
        odid: 0,
        flags: 1,
        data: "",
      },
    ],
    revlog: [
      {
        id: (CRT + (TODAY - 30) * DAY) * 1000,
        cid: 1_700_000_002_001,
        ease: 3,
        ivl: -600,
        time: 8_000,
        type: 0,
      },
      {
        id: (CRT + (TODAY - 29) * DAY) * 1000,
        cid: 1_700_000_002_001,
        ease: 3,
        ivl: 4,
        time: 90_000,
        type: 0,
      },
      {
        id: (CRT + (TODAY - 7) * DAY) * 1000,
        cid: 1_700_000_002_001,
        ease: 4,
        ivl: 10,
        time: 4_000,
        type: 1,
      },
      {
        id: (CRT + (TODAY - 6) * DAY) * 1000,
        cid: 1_700_000_002_001,
        ease: 0,
        ivl: 10,
        time: 0,
        type: 4,
      },
    ],
  };
}

let seq: number;
let defaultPreset: Preset;
function context(overrides: Partial<AnkiImportContext> = {}): AnkiImportContext {
  return {
    now: NOW_MS,
    ids: { next: () => `00000000-0000-7000-9000-${(++seq).toString(16).padStart(12, "0")}` },
    defaultPresetId: defaultPreset.id,
    existingDecks: [],
    existingPresets: [defaultPreset],
    existingNoteTypes: [],
    existingGuids: new Set(),
    mediaNames: new Map([
      ["gato.png", "abc.png"],
      ["miau.mp3", "def.mp3"],
    ]),
    ...overrides,
  };
}

beforeEach(() => {
  seq = 0;
  defaultPreset = makePreset({ name: "Padrão" });
});

const plan = (
  ctx: Partial<AnkiImportContext> = {},
  collection: AnkiCollection = parseAnkiCollection(raw()),
) => planAnkiImport(collection, context(ctx));

describe("parseAnkiCollection", () => {
  it("rejects a collection whose JSON or rows are malformed", () => {
    expect(() => parseAnkiCollection({ ...raw(), col: { ...raw().col, models: "{" } })).toThrow();
    expect(() => parseAnkiCollection({ ...raw(), notes: [{ id: "x" }] })).toThrow();
  });
});

describe("planAnkiImport — structure", () => {
  it("creates the deck tree from :: names, skipping the empty Default and filtered decks", () => {
    const { decks } = plan();
    const ingles = decks.find((d) => d.name === "Inglês");
    const animais = decks.find((d) => d.name === "Animais");
    expect(decks).toHaveLength(2);
    expect(ingles?.parentId).toBeNull();
    expect(animais).toMatchObject({ parentId: ingles?.id, collapsed: true });
  });

  it("reuses existing decks with the same path", () => {
    const existing = makeDeck({ name: "inglês", presetId: defaultPreset.id });
    const { decks, cards } = plan({ existingDecks: [existing] });
    expect(decks.map((d) => d.name)).toEqual(["Animais"]);
    expect(decks[0]?.parentId).toBe(existing.id);
    expect(cards.find((c) => c.templateOrd === 0 && c.queue === "learning")?.deckId).toBe(
      existing.id,
    );
  });

  it("maps Anki's Default options to the default preset and creates the others", () => {
    const { presets, decks } = plan();
    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({
      name: "Intenso",
      newPerDay: 50,
      reviewsPerDay: 500,
      learningSteps: ["5m", "30m", "1d"],
      relearningSteps: ["15m"],
      maximumIntervalDays: 3650,
      leechThreshold: 6,
      leechAction: "suspend",
      desiredRetention: 0.85,
    });
    expect(decks.find((d) => d.name === "Inglês")?.presetId).toBe(defaultPreset.id);
    expect(decks.find((d) => d.name === "Animais")?.presetId).toBe(presets[0]?.id);
  });

  it("reuses an existing preset with the same name", () => {
    const intenso = makePreset({ name: "Intenso" });
    const { presets, decks } = plan({ existingPresets: [defaultPreset, intenso] });
    expect(presets).toEqual([]);
    expect(decks.find((d) => d.name === "Animais")?.presetId).toBe(intenso.id);
  });

  it("converts note types, keeping fields, templates and CSS", () => {
    const { noteTypes } = plan();
    const basic = noteTypes.find((nt) => nt.name === "Basic");
    expect(basic).toMatchObject({
      kind: "standard",
      fields: [
        { id: "f0", name: "Front", sticky: true, rtl: false },
        { id: "f1", name: "Back", sticky: false, rtl: false },
      ],
      templates: [
        {
          id: "t0",
          name: "Card 1",
          front: "{{Front}}",
          back: "{{FrontSide}}<hr id=answer>{{Back}}",
        },
      ],
      css: ".card { color: red; }",
    });
    expect(noteTypes.find((nt) => nt.name === "Cloze")?.kind).toBe("cloze");
  });

  it("reuses an identical note type imported before", () => {
    const first = plan().noteTypes.find((nt) => nt.name === "Basic");
    if (!first) throw new Error("no Basic");
    const { noteTypes, notes } = plan({ existingNoteTypes: [first] });
    expect(noteTypes.map((nt) => nt.name)).toEqual(["Cloze"]);
    expect(notes.find((n) => n.guid === "g-cat")?.noteTypeId).toBe(first.id);
  });

  it("does not reuse a note type that only shares the name", () => {
    const other = makeNoteType({ name: "Basic" });
    expect(plan({ existingNoteTypes: [other] }).noteTypes.map((nt) => nt.name)).toContain("Basic");
  });
});

describe("planAnkiImport — notes", () => {
  it("imports fields by position, tags normalised, guid kept, media renamed", () => {
    const cat = plan().notes.find((n) => n.guid === "g-cat");
    expect(cat).toMatchObject({
      fields: { f0: "cat", f1: 'gato <img src="abc.png"> <audio controls src="def.mp3"></audio>' },
      tags: ["animais", "ingles"],
      sortField: "cat",
      createdAt: 1_700_000_001_001,
      updatedAt: (CRT + 100) * 1000,
      deletedAt: null,
    });
  });

  it("skips notes already imported (same guid), with their cards", () => {
    const result = plan({ existingGuids: new Set(["g-cat"]) });
    expect(result.notes.map((n) => n.guid)).toEqual(["g-dog", "g-brz"]);
    expect(result.cards).toHaveLength(2);
    expect(result.reviewLogs).toEqual([]);
    expect(result.skippedNotes).toBe(1);
  });
});

describe("planAnkiImport — cards", () => {
  it("keeps the card's current schedule and history", () => {
    const { cards, notes, reviewLogs } = plan();
    const catId = notes.find((n) => n.guid === "g-cat")?.id;
    const review = cards.find((c) => c.noteId === catId);
    expect(review).toMatchObject({
      queue: "review",
      state: "review",
      due: (CRT + (TODAY + 3) * DAY) * 1000,
      scheduledDays: 10,
      reps: 5,
      lapses: 1,
      lastReviewAt: (CRT + (TODAY - 7) * DAY) * 1000,
    });
    expect(review?.stability).toBeGreaterThan(0);
    expect(reviewLogs.map((l) => [l.rating, l.reviewedAt, l.durationMs])).toEqual([
      [3, (CRT + (TODAY - 30) * DAY) * 1000, 8_000],
      [3, (CRT + (TODAY - 29) * DAY) * 1000, 60_000],
      [4, (CRT + (TODAY - 7) * DAY) * 1000, 4_000],
    ]);
    expect(reviewLogs.every((l) => l.cardId === review?.id && l.kind === "review")).toBe(true);
    expect(reviewLogs[0]?.stateBefore).toBe("new");
  });

  it("puts cards from filtered decks back in their original deck, keeping new-card order", () => {
    const { cards, decks, notes } = plan();
    const dogId = notes.find((n) => n.guid === "g-dog")?.id;
    const dog = cards.find((c) => c.noteId === dogId);
    expect(dog).toMatchObject({ queue: "new", state: "new", reps: 0, newPosition: CRT * 1000 + 2 });
    expect(dog?.deckId).toBe(decks.find((d) => d.name === "Animais")?.id);
  });

  it("converts learning cards due in seconds, their step and flag", () => {
    const { cards } = plan();
    const learning = cards.find((c) => c.queue === "learning");
    expect(learning).toMatchObject({
      state: "learning",
      due: NOW_MS + 600_000,
      learningStep: 1,
      flag: 1,
    });
  });

  it("keeps suspended cards suspended and releases buried ones", () => {
    const base = raw();
    base.cards[0] = { ...(base.cards[0] as (typeof base.cards)[0]), queue: -1 };
    base.cards[1] = { ...(base.cards[1] as (typeof base.cards)[1]), queue: -3 };
    const { cards, notes } = plan({}, parseAnkiCollection(base));
    const byGuid = (g: string) =>
      cards.find((c) => c.noteId === notes.find((n) => n.guid === g)?.id);
    expect(byGuid("g-cat")).toMatchObject({ queue: "suspended", state: "review" });
    expect(byGuid("g-dog")).toMatchObject({ queue: "new", buriedUntilDay: null });
  });

  it("uses FSRS memory stored by Anki when present", () => {
    const base = raw();
    base.cards[0] = {
      ...(base.cards[0] as (typeof base.cards)[0]),
      data: JSON.stringify({ s: 12.5, d: 6.2 }),
    };
    const { cards } = plan({}, parseAnkiCollection(base));
    expect(cards.find((c) => c.queue === "review")).toMatchObject({
      stability: 12.5,
      difficulty: 6.2,
    });
  });

  it("estimates memory from the interval for review cards without history", () => {
    const base = raw();
    base.revlog = [];
    const { cards } = plan({}, parseAnkiCollection(base));
    expect(cards.find((c) => c.queue === "review")).toMatchObject({
      stability: 10,
      difficulty: 5,
      lastReviewAt: (CRT + (TODAY - 7) * DAY) * 1000,
    });
  });
});
