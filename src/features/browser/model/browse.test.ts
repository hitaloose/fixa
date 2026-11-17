import { beforeEach, describe, expect, it } from "vitest";
import {
  FACTORY_NOW,
  makeCard,
  makeDeck,
  makeNote,
  makeNoteType,
} from "../../../../tests/factories";
import type { Card, Deck, Note, NoteType } from "../../../domain/model";
import { type BrowseData, browse, toggleTerm } from "./browse";

let data: BrowseData;
let ingles: Deck;
let math: Deck;
let basic: NoteType;
let cat: Note;
let dog: Note;
let catFront: Card;
let catBack: Card;
let dogCard: Card;

beforeEach(() => {
  ingles = makeDeck({ name: "Inglês" });
  math = makeDeck({ name: "Matemática" });
  basic = makeNoteType();
  cat = makeNote({
    noteTypeId: basic.id,
    fields: { front: "cat", back: "gato" },
    sortField: "cat",
    createdAt: FACTORY_NOW,
    updatedAt: FACTORY_NOW,
  });
  dog = makeNote({
    noteTypeId: basic.id,
    fields: { front: "dog", back: "cão" },
    sortField: "dog",
    createdAt: FACTORY_NOW + 10,
    updatedAt: FACTORY_NOW + 10,
  });
  catFront = makeCard({
    noteId: cat.id,
    deckId: ingles.id,
    createdAt: FACTORY_NOW,
    updatedAt: FACTORY_NOW + 50,
    due: FACTORY_NOW + 300,
  });
  catBack = makeCard({
    noteId: cat.id,
    deckId: math.id,
    templateOrd: 1,
    createdAt: FACTORY_NOW,
    updatedAt: FACTORY_NOW,
    queue: "review",
    state: "review",
    due: FACTORY_NOW + 100,
    reps: 1,
  });
  dogCard = makeCard({
    noteId: dog.id,
    deckId: ingles.id,
    createdAt: FACTORY_NOW + 10,
    updatedAt: FACTORY_NOW + 10,
    queue: "suspended",
    state: "review",
    due: FACTORY_NOW + 200,
    reps: 1,
  });
  data = {
    cards: [catFront, catBack, dogCard],
    notes: [cat, dog],
    decks: [ingles, math],
    noteTypes: [basic],
    endOfDay: FACTORY_NOW + 1_000,
  };
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("browse", () => {
  it("lists cards newest first, with their note text, deck and status", () => {
    const rows = browse(data, { query: "", sort: "added", mode: "cards" });
    expect(ids(rows)).toEqual([dogCard.id, catFront.id, catBack.id]);
    expect(rows[0]).toMatchObject({
      noteId: dog.id,
      cardIds: [dogCard.id],
      text: "dog",
      deckPath: "Inglês",
      status: "suspended",
      due: dogCard.due,
    });
  });

  it("filters with the search syntax", () => {
    expect(ids(browse(data, { query: "deck:inglês", sort: "added", mode: "cards" }))).toEqual([
      dogCard.id,
      catFront.id,
    ]);
    expect(ids(browse(data, { query: "gato is:review", sort: "added", mode: "cards" }))).toEqual([
      catBack.id,
    ]);
  });

  it("groups matching cards by note in notes mode", () => {
    const rows = browse(data, { query: "", sort: "text", mode: "notes" });
    expect(rows.map((r) => [r.id, r.cardIds])).toEqual([
      [cat.id, [catFront.id, catBack.id]],
      [dog.id, [dogCard.id]],
    ]);
    expect(
      browse(data, { query: "deck:matemática", sort: "text", mode: "notes" })[0]?.cardIds,
    ).toEqual([catBack.id]);
  });

  it("sorts by due date, text or last change", () => {
    expect(ids(browse(data, { query: "", sort: "due", mode: "cards" }))).toEqual([
      catBack.id,
      dogCard.id,
      catFront.id,
    ]);
    expect(ids(browse(data, { query: "", sort: "text", mode: "cards" }))).toEqual([
      catFront.id,
      catBack.id,
      dogCard.id,
    ]);
    expect(ids(browse(data, { query: "", sort: "modified", mode: "cards" }))[0]).toBe(catFront.id);
  });

  it("puts new cards after scheduled ones when sorting by due date", () => {
    const scheduled = {
      ...catFront,
      queue: "review" as const,
      state: "review" as const,
      reps: 1,
      due: FACTORY_NOW + 999,
    };
    const newer = { ...dogCard, queue: "new" as const, state: "new" as const, reps: 0, due: 0 };
    const rows = browse(
      { ...data, cards: [newer, scheduled] },
      { query: "", sort: "due", mode: "cards" },
    );
    expect(ids(rows)).toEqual([scheduled.id, newer.id]);
  });

  it("skips cards whose note is missing", () => {
    const orphan = makeCard({ deckId: ingles.id });
    expect(
      browse({ ...data, cards: [orphan] }, { query: "", sort: "added", mode: "cards" }),
    ).toEqual([]);
  });
});

describe("toggleTerm", () => {
  it("adds a term that is not in the query and removes one that is", () => {
    expect(toggleTerm("gato", "is:new")).toBe("gato is:new");
    expect(toggleTerm("gato is:new", "is:new")).toBe("gato");
    expect(toggleTerm("", "is:due")).toBe("is:due");
    expect(toggleTerm("is:due  deck:x", "is:due")).toBe("deck:x");
  });
});
