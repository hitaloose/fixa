import { describe, expect, it } from "vitest";
import {
  FACTORY_NOW,
  makeCard,
  makeDeck,
  makeMedia,
  makeNote,
  makeNoteType,
  makePreset,
  makeReviewLog,
} from "./index";

const first = "00000000-0000-7000-8000-000000000001";
const second = "00000000-0000-7000-8000-000000000002";

describe("factories", () => {
  it("start IDs at 1 in every test (reset before each test)", () => {
    expect(makePreset().id).toBe(first);
    expect(makePreset().id).toBe(second);
  });

  it("start IDs at 1 again in another test", () => {
    expect(makeDeck().id).toBe(first);
  });

  it("use the fixed factory instant for timestamps", () => {
    expect(makeDeck()).toMatchObject({
      createdAt: FACTORY_NOW,
      updatedAt: FACTORY_NOW,
      deletedAt: null,
    });
  });

  it("makePreset applies the documented defaults", () => {
    expect(makePreset()).toMatchObject({ name: "Padrão", newPerDay: 20, desiredRetention: 0.9 });
  });

  it("apply overrides", () => {
    expect(makeDeck({ name: "Inglês", collapsed: true })).toMatchObject({
      name: "Inglês",
      collapsed: true,
    });
  });

  it("throw when overrides produce an invalid entity", () => {
    expect(() => makeCard({ flag: 9 })).toThrow();
  });

  it("makeCard defaults to a new card due at the factory instant", () => {
    expect(makeCard()).toMatchObject({ queue: "new", due: FACTORY_NOW, reps: 0, flag: 0 });
  });

  it("makeNoteType defaults to a two-field basic type", () => {
    const nt = makeNoteType();
    expect(nt.kind).toBe("standard");
    expect(nt.fields.map((f) => f.name)).toEqual(["Frente", "Verso"]);
    expect(nt.templates).toHaveLength(1);
  });

  it("makeNote defaults to the given note type's fields", () => {
    const nt = makeNoteType();
    const note = makeNote({ noteTypeId: nt.id });
    expect(note.noteTypeId).toBe(nt.id);
    expect(note.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("makeReviewLog snapshots a new card by default", () => {
    const card = makeCard();
    const log = makeReviewLog({ cardId: card.id });
    expect(log).toMatchObject({ cardId: card.id, rating: 3, stateBefore: "new", undoneAt: null });
    expect(log.cardBefore).toMatchObject({ queue: "new", reps: 0, due: card.due });
  });

  it("makeMedia produces a content-addressed media record", () => {
    expect(makeMedia().id).toMatch(/^[0-9a-f]{64}$/);
  });
});
