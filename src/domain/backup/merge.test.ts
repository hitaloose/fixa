import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  FACTORY_NOW,
  makeCard,
  makeDeck,
  makeNote,
  makeNoteType,
  makePreset,
} from "../../../tests/factories";
import type { Card, Preset } from "../model";
import { answer, replay } from "../scheduler";
import { type BackupData, mergeBackup } from "./index";

const DAY = 86_400_000;

function base(): { data: BackupData; card: Card; preset: Preset } {
  const preset = makePreset();
  const deck = makeDeck({ presetId: preset.id });
  const noteType = makeNoteType();
  const note = makeNote({ noteTypeId: noteType.id });
  const card = makeCard({ noteId: note.id, deckId: deck.id });
  return {
    data: {
      presets: [preset],
      decks: [deck],
      noteTypes: [noteType],
      notes: [note],
      cards: [card],
      reviewLogs: [],
      settings: {},
    },
    card,
    preset,
  };
}

/** Answers the card on one device and returns that device's data. */
function study(
  data: BackupData,
  preset: Preset,
  cardId: string,
  at: number,
  logId: string,
  rating: 1 | 2 | 3 | 4 = 3,
): BackupData {
  const card = data.cards.find((c) => c.id === cardId) as Card;
  const { nextCard, reviewLog } = answer({
    card,
    rating,
    now: at,
    preset,
    durationMs: 1000,
    logId,
  });
  return {
    ...data,
    cards: data.cards.map((c) => (c.id === cardId ? nextCard : c)),
    reviewLogs: [...data.reviewLogs, reviewLog],
  };
}

const sortById = <T extends { id: string }>(xs: T[]) =>
  [...xs].sort((a, b) => a.id.localeCompare(b.id));
const canonical = (d: ReturnType<typeof mergeBackup>) => ({
  presets: sortById(d.presets),
  decks: sortById(d.decks),
  noteTypes: sortById(d.noteTypes),
  notes: sortById(d.notes),
  cards: sortById(d.cards),
  reviewLogs: sortById(d.reviewLogs),
});

const LOG_A = "00000000-0000-7000-b000-00000000a001";
const LOG_B = "00000000-0000-7000-b000-00000000b001";

describe("mergeBackup", () => {
  it("adds records that exist only on one side", () => {
    const { data } = base();
    const extra = makeDeck({ presetId: data.presets[0]?.id ?? "" });
    const merged = mergeBackup(data, { ...data, decks: [...data.decks, extra] });
    expect(merged.decks.map((d) => d.id).sort()).toEqual(
      [...data.decks, extra].map((d) => d.id).sort(),
    );
  });

  it("keeps the most recently updated version of a record", () => {
    const { data } = base();
    const note = data.notes[0] as BackupData["notes"][0];
    const newer = { ...note, fields: { front: "novo" }, updatedAt: note.updatedAt + 10 };
    const merged = mergeBackup({ ...data, notes: [newer] }, data);
    expect(merged.notes).toEqual([newer]);
    expect(mergeBackup(data, { ...data, notes: [newer] }).notes).toEqual([newer]);
  });

  it("keeps a deletion made on either side", () => {
    const { data } = base();
    const note = data.notes[0] as BackupData["notes"][0];
    const deleted = { ...note, deletedAt: note.updatedAt + 5, updatedAt: note.updatedAt + 5 };
    expect(mergeBackup(data, { ...data, notes: [deleted] }).notes).toEqual([deleted]);
  });

  it("replays reviews made on both devices into one card state", () => {
    const { data, card, preset } = base();
    const a = study(data, preset, card.id, FACTORY_NOW + DAY, LOG_A);
    const b = study(data, preset, card.id, FACTORY_NOW + 2 * DAY, LOG_B, 4);
    const merged = mergeBackup(a, b);
    const logs = merged.reviewLogs;
    expect(logs.map((l) => l.id).sort()).toEqual([LOG_A, LOG_B]);
    const expected = replay(card, logs, preset);
    const { updatedAt, ...state } = merged.cards[0] as Card;
    const { updatedAt: _u, ...expectedState } = expected;
    expect(state).toEqual(expectedState);
    expect(canonical(mergeBackup(b, a))).toEqual(canonical(merged));
  });

  it("does not replay a card whose history did not change", () => {
    const { data, card, preset } = base();
    const a = study(data, preset, card.id, FACTORY_NOW + DAY, LOG_A);
    expect(mergeBackup(a, data).cards).toEqual(a.cards);
    expect(mergeBackup(data, a).cards).toEqual(a.cards);
  });

  it("keeps an undo made on either side", () => {
    const { data, card, preset } = base();
    const a = study(data, preset, card.id, FACTORY_NOW + DAY, LOG_A);
    const undone = {
      ...a,
      reviewLogs: a.reviewLogs.map((l) => ({ ...l, undoneAt: FACTORY_NOW + DAY + 1 })),
    };
    expect(mergeBackup(a, undone).reviewLogs[0]?.undoneAt).toBe(FACTORY_NOW + DAY + 1);
    expect(mergeBackup(undone, a).reviewLogs[0]?.undoneAt).toBe(FACTORY_NOW + DAY + 1);
  });

  it("never resets a card that has progress but no review history (e.g. imported)", () => {
    const { data, card } = base();
    const imported = {
      ...card,
      queue: "review" as const,
      state: "review" as const,
      reps: 9,
      stability: 30,
      difficulty: 5,
      scheduledDays: 30,
      lastReviewAt: FACTORY_NOW,
      updatedAt: card.updatedAt + 1,
    };
    expect(mergeBackup({ ...data, cards: [imported] }, data).cards).toEqual([imported]);
  });

  it("replays when only the other side has new reviews, even if this side's card won", () => {
    const { data, card, preset } = base();
    const b = study(data, preset, card.id, FACTORY_NOW + DAY, LOG_B);
    const flagged = { ...card, flag: 2, updatedAt: FACTORY_NOW + 5 * DAY };
    const merged = mergeBackup({ ...data, cards: [flagged] }, b);
    expect(merged.cards[0]).toMatchObject({ flag: 2, reps: 1, state: "learning" });
  });

  it("leaves a card alone when its deck's preset is unknown", () => {
    const { data, card, preset } = base();
    const b = study(data, preset, card.id, FACTORY_NOW + DAY, LOG_B);
    const flagged = { ...card, flag: 2, updatedAt: FACTORY_NOW + 5 * DAY };
    const merged = mergeBackup({ ...data, presets: [], cards: [flagged] }, { ...b, presets: [] });
    expect(merged.cards).toEqual([flagged]);
  });

  it("merges note types like any other record", () => {
    const { data } = base();
    const extra = makeNoteType();
    expect(
      mergeBackup(data, { ...data, noteTypes: [...data.noteTypes, extra] }).noteTypes,
    ).toHaveLength(2);
  });

  it("keeps the earliest undo when both sides undid the same answer", () => {
    const { data, card, preset } = base();
    const a = study(data, preset, card.id, FACTORY_NOW + DAY, LOG_A);
    const undoAt = (t: number) => ({
      ...a,
      reviewLogs: a.reviewLogs.map((l) => ({ ...l, undoneAt: t })),
    });
    const early = undoAt(FACTORY_NOW + DAY + 1);
    const late = undoAt(FACTORY_NOW + DAY + 9);
    expect(mergeBackup(early, late).reviewLogs[0]?.undoneAt).toBe(FACTORY_NOW + DAY + 1);
    expect(mergeBackup(late, early).reviewLogs[0]?.undoneAt).toBe(FACTORY_NOW + DAY + 1);
  });

  it("is commutative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -3, max: 3 }),
        fc.integer({ min: -3, max: 3 }),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (noteShiftA, noteShiftB, studyA, studyB, deleteB) => {
          const { data, card, preset } = base();
          const note = data.notes[0] as BackupData["notes"][0];
          let a: BackupData = {
            ...data,
            notes: [
              { ...note, fields: { front: "A" }, updatedAt: note.updatedAt + 10 + noteShiftA },
            ],
          };
          let b: BackupData = {
            ...data,
            notes: [
              { ...note, fields: { front: "B" }, updatedAt: note.updatedAt + 10 + noteShiftB },
            ],
          };
          if (studyA) a = study(a, preset, card.id, FACTORY_NOW + DAY, LOG_A);
          if (studyB) b = study(b, preset, card.id, FACTORY_NOW + 2 * DAY, LOG_B, 2);
          if (deleteB) {
            const deck = b.decks[0] as BackupData["decks"][0];
            b = {
              ...b,
              decks: [
                { ...deck, deletedAt: deck.updatedAt + 100, updatedAt: deck.updatedAt + 100 },
              ],
            };
          }
          expect(canonical(mergeBackup(a, b))).toEqual(canonical(mergeBackup(b, a)));
        },
      ),
    );
  });
});
