import { describe, expect, it } from "vitest";
import {
  cardSchema,
  deckSchema,
  mediaSchema,
  noteSchema,
  noteTypeSchema,
  presetSchema,
  reviewLogSchema,
} from "./schemas";

const ID = "00000000-0000-7000-8000-000000000001";
const ID2 = "00000000-0000-7000-8000-000000000002";
const base = { id: ID, createdAt: 1_000, updatedAt: 1_000, deletedAt: null };

describe("base entity fields", () => {
  it("rejects a non-UUID id", () => {
    expect(deckSchema.safeParse({ ...validDeck(), id: "abc" }).success).toBe(false);
  });

  it("rejects updatedAt earlier than createdAt", () => {
    expect(deckSchema.safeParse({ ...validDeck(), updatedAt: 999 }).success).toBe(false);
  });

  it("accepts a soft-deleted entity", () => {
    expect(deckSchema.safeParse({ ...validDeck(), deletedAt: 2_000 }).success).toBe(true);
  });
});

describe("presetSchema", () => {
  it("fills every option with the documented defaults", () => {
    expect(presetSchema.parse(base)).toEqual({
      ...base,
      name: "Padrão",
      newPerDay: 20,
      reviewsPerDay: 200,
      learningSteps: ["1m", "10m"],
      relearningSteps: ["10m"],
      graduatingIntervalDays: 1,
      easyIntervalDays: 4,
      newCardOrder: "sequential",
      reviewOrder: "due",
      leechThreshold: 8,
      leechAction: "tag",
      desiredRetention: 0.9,
      fsrsWeights: null,
      maximumIntervalDays: 36500,
      buryNewSiblings: true,
      buryReviewSiblings: false,
      showTimer: false,
      autoplayAudio: true,
    });
  });

  it.each([
    [0.69, false],
    [0.7, true],
    [0.99, true],
    [1, false],
  ])("desiredRetention %f is valid: %s", (desiredRetention, ok) => {
    expect(presetSchema.safeParse({ ...base, desiredRetention }).success).toBe(ok);
  });

  it.each([
    [["1m", "10m", "1h", "1d"], true],
    [["30s"], false],
    [[], true],
    [["10"], false],
    [["m"], false],
    [["0m"], false],
    [["1.5m"], false],
  ])("learningSteps %j is valid: %s", (learningSteps, ok) => {
    expect(presetSchema.safeParse({ ...base, learningSteps }).success).toBe(ok);
  });

  it("rejects negative daily limits", () => {
    expect(presetSchema.safeParse({ ...base, newPerDay: -1 }).success).toBe(false);
  });

  it("rejects fractional daily limits", () => {
    expect(presetSchema.safeParse({ ...base, reviewsPerDay: 1.5 }).success).toBe(false);
  });
});

function validDeck() {
  return {
    ...base,
    name: "Phrasal verbs",
    parentId: null,
    presetId: ID2,
    description: "",
    collapsed: false,
    overrides: {},
    position: 0,
  };
}

describe("deckSchema", () => {
  it("accepts a valid deck", () => {
    expect(deckSchema.parse(validDeck())).toEqual(validDeck());
  });

  it.each(["", "   ", "A::B"])("rejects the node name %j", (name) => {
    expect(deckSchema.safeParse({ ...validDeck(), name }).success).toBe(false);
  });

  it("accepts per-deck and today-only overrides", () => {
    const overrides = {
      newPerDay: 5,
      todayOnly: { day: "2026-11-17", reviewsPerDay: 50 },
    };
    expect(deckSchema.safeParse({ ...validDeck(), overrides }).success).toBe(true);
  });

  it("rejects a today-only day that is not YYYY-MM-DD", () => {
    const overrides = { todayOnly: { day: "17/11/2026" } };
    expect(deckSchema.safeParse({ ...validDeck(), overrides }).success).toBe(false);
  });
});

function validNoteType() {
  return {
    ...base,
    name: "Básico",
    kind: "standard" as const,
    fields: [
      { id: "f1", name: "Frente", sticky: false, rtl: false },
      { id: "f2", name: "Verso", sticky: false, rtl: false },
    ],
    templates: [
      { id: "t1", name: "Cartão 1", front: "{{Frente}}", back: "{{FrontSide}}<hr>{{Verso}}" },
    ],
    css: "",
  };
}

describe("noteTypeSchema", () => {
  it("accepts a valid note type", () => {
    expect(noteTypeSchema.parse(validNoteType())).toEqual(validNoteType());
  });

  it("requires at least one field", () => {
    expect(noteTypeSchema.safeParse({ ...validNoteType(), fields: [] }).success).toBe(false);
  });

  it("requires at least one template", () => {
    expect(noteTypeSchema.safeParse({ ...validNoteType(), templates: [] }).success).toBe(false);
  });

  it("rejects duplicate field names", () => {
    const nt = validNoteType();
    const fields = [nt.fields[0], { ...nt.fields[1], name: "Frente" }];
    expect(noteTypeSchema.safeParse({ ...nt, fields }).success).toBe(false);
  });

  it("rejects a cloze type with more than one template", () => {
    const nt = validNoteType();
    const templates = [nt.templates[0], { ...nt.templates[0], id: "t2" }];
    expect(noteTypeSchema.safeParse({ ...nt, kind: "cloze", templates }).success).toBe(false);
  });
});

function validNote() {
  return {
    ...base,
    noteTypeId: ID2,
    fields: { f1: "\\( \\frac{3}{4} \\)", f2: "três quartos" },
    tags: ["math::fractions", "basics"],
    sortField: "\\( \\frac{3}{4} \\)",
    checksum: "a".repeat(64),
  };
}

describe("noteSchema", () => {
  it("accepts a valid note", () => {
    expect(noteSchema.parse(validNote())).toEqual(validNote());
  });

  it.each(["Math", "has space", ""])("rejects the tag %j", (tag) => {
    expect(noteSchema.safeParse({ ...validNote(), tags: [tag] }).success).toBe(false);
  });
});

function validCard() {
  return {
    ...base,
    noteId: ID2,
    deckId: ID2,
    templateOrd: 0,
    queue: "new" as const,
    state: "new" as const,
    buriedUntilDay: null,
    newPosition: 0,
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
  };
}

describe("cardSchema", () => {
  it("accepts a valid new card", () => {
    expect(cardSchema.parse(validCard())).toEqual(validCard());
  });

  it.each([
    [0, true],
    [7, true],
    [8, false],
    [-1, false],
  ])("flag %i is valid: %s", (flag, ok) => {
    expect(cardSchema.safeParse({ ...validCard(), flag }).success).toBe(ok);
  });

  it("requires buriedUntilDay when the card is buried", () => {
    expect(cardSchema.safeParse({ ...validCard(), queue: "buried" }).success).toBe(false);
    expect(
      cardSchema.safeParse({ ...validCard(), queue: "buried", buriedUntilDay: "2026-11-17" })
        .success,
    ).toBe(true);
  });

  it("rejects buriedUntilDay on a card that is not buried", () => {
    expect(cardSchema.safeParse({ ...validCard(), buriedUntilDay: "2026-11-17" }).success).toBe(
      false,
    );
  });

  it("keeps the FSRS state while suspended or buried", () => {
    const review = { ...validCard(), state: "review" as const, reps: 3 };
    expect(cardSchema.safeParse({ ...review, queue: "suspended" }).success).toBe(true);
    expect(
      cardSchema.safeParse({ ...review, queue: "buried", buriedUntilDay: "2026-11-17" }).success,
    ).toBe(true);
  });

  it("requires queue to equal the FSRS state when the card is studyable", () => {
    expect(
      cardSchema.safeParse({ ...validCard(), queue: "review", state: "learning" }).success,
    ).toBe(false);
    expect(cardSchema.safeParse({ ...validCard(), queue: "review", state: "review" }).success).toBe(
      true,
    );
  });

  it("rejects a missing FSRS state", () => {
    const { state: _state, ...withoutState } = validCard();
    expect(cardSchema.safeParse(withoutState).success).toBe(false);
  });

  it("rejects an unknown queue", () => {
    expect(cardSchema.safeParse({ ...validCard(), queue: "done" }).success).toBe(false);
  });
});

function validLog() {
  return {
    id: ID,
    cardId: ID2,
    reviewedAt: 5_000,
    rating: 3,
    stateBefore: "new" as const,
    cardBefore: {
      queue: "new" as const,
      state: "new" as const,
      buriedUntilDay: null,
      due: 1_000,
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      learningStep: 0,
      reps: 0,
      lapses: 0,
      lastReviewAt: null,
    },
    scheduledDays: 0,
    elapsedDays: 0,
    durationMs: 4_200,
    kind: "review" as const,
    undoneAt: null,
  };
}

describe("reviewLogSchema", () => {
  it("accepts a valid log", () => {
    expect(reviewLogSchema.parse(validLog())).toEqual(validLog());
  });

  it.each([0, 5, 2.5])("rejects rating %f", (rating) => {
    expect(reviewLogSchema.safeParse({ ...validLog(), rating }).success).toBe(false);
  });

  it.each(["reschedule", "reset", "manual"])("stores no rating (0) for a %s log", (kind) => {
    expect(reviewLogSchema.safeParse({ ...validLog(), kind, rating: 0 }).success).toBe(true);
    const rated = reviewLogSchema.safeParse({ ...validLog(), kind, rating: 3 });
    expect(rated.success).toBe(false);
    expect(rated.error?.issues[0]).toMatchObject({
      path: ["rating"],
      message: "only review logs have a rating (1–4); other kinds use 0",
    });
  });

  it("rejects a negative duration", () => {
    expect(reviewLogSchema.safeParse({ ...validLog(), durationMs: -1 }).success).toBe(false);
  });
});

describe("mediaSchema", () => {
  const media = {
    id: "ab".repeat(32),
    fileName: "ab.png",
    mime: "image/png",
    size: 3,
    blob: new Blob(["abc"]),
  };

  it("accepts media keyed by a SHA-256 hex digest", () => {
    expect(mediaSchema.safeParse(media).success).toBe(true);
  });

  it("rejects an id that is not a SHA-256 hex digest", () => {
    expect(mediaSchema.safeParse({ ...media, id: ID }).success).toBe(false);
  });
});
