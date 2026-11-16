/**
 * Deterministic test data. Every factory parses through the domain schema, so a factory
 * can never produce an invalid entity. IDs are sequential and reset before each test
 * (tests/setup.node.ts).
 */
import {
  type Card,
  type CardSnapshot,
  cardSchema,
  type Deck,
  deckSchema,
  type Media,
  mediaSchema,
  type Note,
  type NoteType,
  noteSchema,
  noteTypeSchema,
  type Preset,
  presetSchema,
  type ReviewLog,
  reviewLogSchema,
} from "../../src/domain/model";
import { sequentialIds } from "../../src/lib/ids";

/** 2026-11-16T12:00:00Z */
export const FACTORY_NOW = Date.UTC(2026, 10, 16, 12, 0, 0);

let ids = sequentialIds();
let counter = 0;

export function resetFactories(): void {
  ids = sequentialIds();
  counter = 0;
}

const nextId = () => ids.next();
const nextHex64 = () => {
  counter += 1;
  return counter.toString(16).padStart(64, "0");
};

const base = () => ({
  id: nextId(),
  createdAt: FACTORY_NOW,
  updatedAt: FACTORY_NOW,
  deletedAt: null,
});

export function makePreset(overrides: Partial<Preset> = {}): Preset {
  return presetSchema.parse({ ...base(), ...overrides });
}

export function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return deckSchema.parse({
    ...base(),
    name: "Baralho",
    parentId: null,
    presetId: overrides.presetId ?? nextId(),
    description: "",
    collapsed: false,
    overrides: {},
    position: 0,
    ...overrides,
  });
}

export function makeNoteType(overrides: Partial<NoteType> = {}): NoteType {
  return noteTypeSchema.parse({
    ...base(),
    name: "Básico",
    kind: "standard",
    fields: [
      { id: "front", name: "Frente", sticky: false, rtl: false },
      { id: "back", name: "Verso", sticky: false, rtl: false },
    ],
    templates: [
      {
        id: "card1",
        name: "Cartão 1",
        front: "{{Frente}}",
        back: "{{FrontSide}}<hr id=answer>{{Verso}}",
      },
    ],
    css: "",
    ...overrides,
  });
}

export function makeNote(overrides: Partial<Note> = {}): Note {
  return noteSchema.parse({
    ...base(),
    noteTypeId: overrides.noteTypeId ?? nextId(),
    fields: { front: "Frente", back: "Verso" },
    tags: [],
    sortField: "Frente",
    checksum: nextHex64(),
    ...overrides,
  });
}

const NEW_SCHEDULING: CardSnapshot = {
  queue: "new",
  buriedUntilDay: null,
  due: FACTORY_NOW,
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  learningStep: 0,
  reps: 0,
  lapses: 0,
  lastReviewAt: null,
};

export function makeCard(overrides: Partial<Card> = {}): Card {
  return cardSchema.parse({
    ...base(),
    noteId: overrides.noteId ?? nextId(),
    deckId: overrides.deckId ?? nextId(),
    templateOrd: 0,
    newPosition: 0,
    flag: 0,
    ...NEW_SCHEDULING,
    ...overrides,
  });
}

export function makeReviewLog(overrides: Partial<ReviewLog> = {}): ReviewLog {
  return reviewLogSchema.parse({
    id: nextId(),
    cardId: overrides.cardId ?? nextId(),
    reviewedAt: FACTORY_NOW,
    rating: 3,
    stateBefore: "new",
    cardBefore: NEW_SCHEDULING,
    scheduledDays: 0,
    elapsedDays: 0,
    durationMs: 5_000,
    kind: "review",
    undoneAt: null,
    ...overrides,
  });
}

export function makeMedia(overrides: Partial<Media> = {}): Media {
  const id = overrides.id ?? nextHex64();
  return mediaSchema.parse({
    id,
    fileName: `${id}.png`,
    mime: "image/png",
    size: 3,
    blob: new Blob(["abc"], { type: "image/png" }),
    ...overrides,
  });
}
