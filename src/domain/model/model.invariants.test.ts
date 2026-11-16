import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  cardSchema,
  deckSchema,
  mediaSchema,
  noteSchema,
  noteTypeSchema,
  presetSchema,
  reviewLogSchema,
  settingsSchema,
} from "./schemas";

/** Field-level issues (path + message), so forms can show the error next to the right field. */
function issues(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) return [];
  return result.error.issues.map((i) => ({ path: i.path, message: i.message }));
}

const ID = "00000000-0000-7000-8000-000000000001";
const HEX = "a".repeat(64);
const base = { id: ID, createdAt: 1_000, updatedAt: 1_000, deletedAt: null };
const deck = {
  ...base,
  name: "Deck",
  parentId: null,
  presetId: ID,
  description: "",
  collapsed: false,
  overrides: {},
  position: 0,
};
const scheduling = {
  queue: "new",
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
const card = {
  ...base,
  noteId: ID,
  deckId: ID,
  templateOrd: 0,
  newPosition: 0,
  flag: 0,
  ...scheduling,
};
const field = (id: string, name: string) => ({ id, name, sticky: false, rtl: false });
const template = (id: string) => ({ id, name: id, front: "", back: "" });
const noteType = {
  ...base,
  name: "T",
  kind: "standard",
  fields: [field("a", "A")],
  templates: [template("t1")],
  css: "",
};
const note = { ...base, noteTypeId: ID, fields: {}, tags: [], sortField: "", checksum: HEX };
const log = {
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
};
const media = { id: HEX, fileName: "a.png", mime: "image/png", size: 1, blob: new Blob(["a"]) };

describe("refinement issues point at the offending field", () => {
  it("updatedAt earlier than createdAt", () => {
    expect(issues(deckSchema, { ...deck, updatedAt: 999 })).toEqual([
      { path: ["updatedAt"], message: "updatedAt must not be earlier than createdAt" },
    ]);
  });

  it("blank deck name", () => {
    expect(issues(deckSchema, { ...deck, name: " " })).toEqual([
      { path: ["name"], message: "deck name must not be blank" },
    ]);
  });

  it("deck name containing the hierarchy separator", () => {
    expect(issues(deckSchema, { ...deck, name: "A::B" })).toEqual([
      { path: ["name"], message: "store the node name only; hierarchy lives in parentId" },
    ]);
  });

  it("buried card without buriedUntilDay", () => {
    expect(issues(cardSchema, { ...card, queue: "buried" })).toEqual([
      {
        path: ["buriedUntilDay"],
        message: "buriedUntilDay is set exactly when the card is buried",
      },
    ]);
  });

  it("duplicate field names", () => {
    expect(
      issues(noteTypeSchema, { ...noteType, fields: [field("a", "A"), field("b", "A")] }),
    ).toEqual([{ path: ["fields"], message: "field names must be unique" }]);
  });

  it("cloze type with two templates", () => {
    expect(
      issues(noteTypeSchema, {
        ...noteType,
        kind: "cloze",
        templates: [template("1"), template("2")],
      }),
    ).toEqual([{ path: ["templates"], message: "a cloze note type has exactly one template" }]);
  });

  it("tag with whitespace", () => {
    expect(issues(noteSchema, { ...note, tags: ["a b"] })).toEqual([
      { path: ["tags", 0], message: "tags must not contain whitespace" },
    ]);
  });

  it("tag with uppercase", () => {
    expect(issues(noteSchema, { ...note, tags: ["Ab"] })).toEqual([
      { path: ["tags", 0], message: "tags must be lowercase" },
    ]);
  });

  it("malformed day", () => {
    expect(
      issues(deckSchema, { ...deck, overrides: { todayOnly: { day: "17/11/2026" } } }),
    ).toEqual([{ path: ["overrides", "todayOnly", "day"], message: "expected YYYY-MM-DD" }]);
  });

  it("malformed learning step", () => {
    expect(issues(presetSchema, { ...base, learningSteps: ["10"] })).toEqual([
      { path: ["learningSteps", 0], message: "expected a step like 10m" },
    ]);
  });
});

describe("patterns are anchored at both ends", () => {
  it.each(["x2026-11-17", "2026-11-17x"])("day %j", (day) => {
    expect(deckSchema.safeParse({ ...deck, overrides: { todayOnly: { day } } }).success).toBe(
      false,
    );
  });

  it.each([`x${HEX}`, `${HEX}x`])("note checksum %j", (checksum) => {
    expect(noteSchema.safeParse({ ...note, checksum }).success).toBe(false);
  });

  it.each([`x${HEX}`, `${HEX}0`])("media id %j", (id) => {
    expect(mediaSchema.safeParse({ ...media, id }).success).toBe(false);
  });

  it.each(["10mx", "x10m"])("learning step %j", (step) => {
    expect(presetSchema.safeParse({ ...base, learningSteps: [step] }).success).toBe(false);
  });
});

describe("every documented enum value is accepted and others rejected", () => {
  it.each(["new", "learning", "review", "relearning", "suspended"])("card queue %s", (queue) => {
    expect(cardSchema.safeParse({ ...card, queue }).success).toBe(true);
  });

  it("card queue buried (with its day)", () => {
    expect(
      cardSchema.safeParse({ ...card, queue: "buried", buriedUntilDay: "2026-11-17" }).success,
    ).toBe(true);
  });

  it.each(["new", "learning", "review", "relearning"])(
    "review log stateBefore %s",
    (stateBefore) => {
      expect(reviewLogSchema.safeParse({ ...log, stateBefore }).success).toBe(true);
    },
  );

  it.each(["suspended", "buried", ""])("review log stateBefore %j is rejected", (stateBefore) => {
    expect(reviewLogSchema.safeParse({ ...log, stateBefore }).success).toBe(false);
  });

  it.each(["review", "manual", "reschedule", "reset"])("review log kind %s", (kind) => {
    expect(reviewLogSchema.safeParse({ ...log, kind }).success).toBe(true);
  });

  it("review log kind outside the list is rejected", () => {
    expect(reviewLogSchema.safeParse({ ...log, kind: "" }).success).toBe(false);
  });

  it.each([
    ["newCardOrder", ["sequential", "random"]],
    ["reviewOrder", ["due", "random", "deck"]],
    ["leechAction", ["tag", "suspend"]],
  ] as const)("preset %s accepts %j and rejects others", (key, values) => {
    for (const value of values)
      expect(presetSchema.safeParse({ ...base, [key]: value }).success).toBe(true);
    expect(presetSchema.safeParse({ ...base, [key]: "" }).success).toBe(false);
  });

  it.each(["standard", "cloze"])("note type kind %s", (kind) => {
    expect(noteTypeSchema.safeParse({ ...noteType, kind }).success).toBe(true);
  });

  it.each([
    ["light", true],
    ["dark", true],
    ["", false],
  ])("settings theme %j is valid: %s", (theme, ok) => {
    expect(settingsSchema.shape.theme.safeParse(theme).success).toBe(ok);
  });
});
