import { describe, expect, it } from "vitest";
import * as model from "./index";
import {
  parseCard,
  parseDeck,
  parseMedia,
  parseNote,
  parseNoteType,
  parsePreset,
  parseReviewLog,
  parseSetting,
  safeParseSetting,
} from "./index";

const ID = "00000000-0000-7000-8000-000000000001";
const base = { id: ID, createdAt: 1, updatedAt: 1, deletedAt: null };
const scheduling = {
  queue: "new",
  state: "new",
  buriedUntilDay: null,
  due: 0,
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  learningStep: 0,
  reps: 0,
  lapses: 0,
  lastReviewAt: null,
};

const valid = {
  deck: {
    ...base,
    name: "D",
    parentId: null,
    presetId: ID,
    description: "",
    collapsed: false,
    overrides: {},
    position: 0,
  },
  noteType: {
    ...base,
    name: "T",
    kind: "standard",
    fields: [{ id: "a", name: "A", sticky: false, rtl: false }],
    templates: [{ id: "t", name: "t", front: "", back: "" }],
    css: "",
  },
  note: { ...base, noteTypeId: ID, fields: {}, tags: [], sortField: "", checksum: "a".repeat(64) },
  card: { ...base, noteId: ID, deckId: ID, templateOrd: 0, newPosition: 0, flag: 0, ...scheduling },
  reviewLog: {
    id: ID,
    cardId: ID,
    reviewedAt: 0,
    rating: 3,
    stateBefore: "new",
    cardBefore: scheduling,
    scheduledDays: 0,
    elapsedDays: 0,
    durationMs: 0,
    kind: "review",
    undoneAt: null,
  },
  media: {
    id: "a".repeat(64),
    fileName: "a.png",
    mime: "image/png",
    size: 1,
    blob: new Blob(["a"]),
  },
};

describe("domain/model public API", () => {
  it("exposes parse functions and types, never zod schemas", () => {
    expect(Object.keys(model).filter((k) => /schema/i.test(k))).toEqual([]);
  });

  it.each([
    ["parseDeck", parseDeck, valid.deck],
    ["parseNoteType", parseNoteType, valid.noteType],
    ["parseNote", parseNote, valid.note],
    ["parseCard", parseCard, valid.card],
    ["parseReviewLog", parseReviewLog, valid.reviewLog],
    ["parseMedia", parseMedia, valid.media],
  ] as const)("%s returns the validated entity", (_name, parse, input) => {
    expect(parse(input)).toEqual(input);
  });

  it.each([
    ["parseDeck", parseDeck, { ...valid.deck, name: "" }],
    ["parseNoteType", parseNoteType, { ...valid.noteType, fields: [] }],
    ["parseNote", parseNote, { ...valid.note, tags: ["A"] }],
    ["parseCard", parseCard, { ...valid.card, flag: 8 }],
    ["parseReviewLog", parseReviewLog, { ...valid.reviewLog, rating: 0 }],
    ["parseMedia", parseMedia, { ...valid.media, id: "x" }],
    ["parsePreset", parsePreset, { ...base, desiredRetention: 1 }],
  ] as const)("%s throws on invalid input", (_name, parse, input) => {
    expect(() => parse(input)).toThrow();
  });

  it("parsePreset fills the documented defaults", () => {
    expect(parsePreset(base)).toMatchObject({
      name: "Padrão",
      newPerDay: 20,
      desiredRetention: 0.9,
    });
  });

  it("parseSetting returns a valid value and throws on an invalid one", () => {
    expect(parseSetting("cutoffHour", 5)).toBe(5);
    expect(() => parseSetting("cutoffHour", 24)).toThrow();
  });

  it("safeParseSetting returns undefined instead of throwing", () => {
    expect(safeParseSetting("theme", "dark")).toBe("dark");
    expect(safeParseSetting("theme", "blue")).toBeUndefined();
    expect(safeParseSetting("lastBackupAt", undefined)).toBeUndefined();
  });
});
