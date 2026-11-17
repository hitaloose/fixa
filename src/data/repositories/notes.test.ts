import { beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { makeNoteType } from "../../../tests/factories";
import type { NoteType } from "../../domain/model";
import { fixedClock } from "../../lib/clock";
import { sha256Hex } from "../../lib/hash";
import type { FixaDb } from "../db";
import { createRepositories, NoteOperationError } from "./index";

const T0 = 5_000_000;
const DECK = "00000000-0000-7000-8000-00000000d001";

let db: FixaDb;
let clock: ReturnType<typeof fixedClock>;
let repos: ReturnType<typeof createRepositories>;
let reversed: NoteType;
let cloze: NoteType;

beforeEach(async () => {
  db = testDb();
  clock = fixedClock(T0);
  let n = 0;
  const ids = { next: () => `00000000-0000-7000-9000-${(++n).toString(16).padStart(12, "0")}` };
  repos = createRepositories({ db, clock, ids });
  reversed = makeNoteType({
    templates: [
      { id: "t1", name: "Cartão 1", front: "{{Frente}}", back: "{{Verso}}" },
      { id: "t2", name: "Cartão 2", front: "{{Verso}}", back: "{{Frente}}" },
    ],
  });
  cloze = makeNoteType({
    kind: "cloze",
    fields: [
      { id: "text", name: "Texto", sticky: false, rtl: false },
      { id: "extra", name: "Extra", sticky: false, rtl: false },
    ],
    templates: [{ id: "c", name: "Omissão", front: "{{cloze:Texto}}", back: "{{cloze:Texto}}" }],
  });
  await db.noteTypes.bulkAdd([reversed, cloze]);
});

const activeCards = async (noteId: string) =>
  (await db.cards.where("noteId").equals(noteId).toArray())
    .filter((c) => c.deletedAt === null)
    .map((c) => c.templateOrd)
    .sort();

describe("notes.add", () => {
  it("stores the note with its sort field and duplicate checksum", async () => {
    const { note } = await repos.notes.add({
      noteTypeId: reversed.id,
      deckId: DECK,
      fields: { front: "<b>cat</b>&nbsp;", back: "gato" },
      tags: ["animais"],
    });
    expect(await db.notes.get(note.id)).toEqual({
      id: note.id,
      noteTypeId: reversed.id,
      fields: { front: "<b>cat</b>&nbsp;", back: "gato" },
      tags: ["animais"],
      sortField: "cat",
      checksum: await sha256Hex("cat"),
      createdAt: T0,
      updatedAt: T0,
      deletedAt: null,
    });
  });

  it("creates one new card per generated template in the chosen deck", async () => {
    const { note, cards } = await repos.notes.add({
      noteTypeId: reversed.id,
      deckId: DECK,
      fields: { front: "cat", back: "gato" },
      tags: [],
    });
    expect(cards.map((c) => [c.templateOrd, c.deckId, c.queue, c.newPosition])).toEqual([
      [0, DECK, "new", T0],
      [1, DECK, "new", T0],
    ]);
    expect(await activeCards(note.id)).toEqual([0, 1]);
  });

  it("creates a card per cloze number", async () => {
    const { cards } = await repos.notes.add({
      noteTypeId: cloze.id,
      deckId: DECK,
      fields: { text: "{{c1::a}} {{c3::b}}", extra: "" },
      tags: [],
    });
    expect(cards.map((c) => c.templateOrd)).toEqual([0, 2]);
  });

  it("refuses a note that would have no cards", async () => {
    const attempt = repos.notes.add({
      noteTypeId: reversed.id,
      deckId: DECK,
      fields: { front: "<br>", back: "" },
      tags: [],
    });
    await expect(attempt).rejects.toEqual(new NoteOperationError("no-cards"));
    expect(await db.notes.count()).toBe(0);
  });

  it("refuses an unknown note type", async () => {
    const attempt = repos.notes.add({ noteTypeId: DECK, deckId: DECK, fields: {}, tags: [] });
    await expect(attempt).rejects.toEqual(new NoteOperationError("not-found"));
  });

  it("records the addition in the history, newest first", async () => {
    const add = (front: string) =>
      repos.notes.add({ noteTypeId: reversed.id, deckId: DECK, fields: { front }, tags: [] });
    const first = await add("one");
    clock.advance(1);
    const second = await add("two");
    expect((await repos.notes.recentlyAdded()).map((n) => n.id)).toEqual([
      second.note.id,
      first.note.id,
    ]);
  });
});

describe("notes.recentlyAdded", () => {
  it("skips deleted notes and respects the limit", async () => {
    const add = (front: string) =>
      repos.notes.add({ noteTypeId: reversed.id, deckId: DECK, fields: { front }, tags: [] });
    const a = await add("a");
    await add("b");
    await add("c");
    await repos.notes.softDelete(a.note.id);
    expect((await repos.notes.recentlyAdded(5)).map((n) => n.sortField)).toEqual(["c", "b"]);
    expect((await repos.notes.recentlyAdded(1)).map((n) => n.sortField)).toEqual(["c"]);
  });
});

describe("notes.edit", () => {
  it("updates fields, tags, sort field and checksum", async () => {
    const { note } = await repos.notes.add({
      noteTypeId: reversed.id,
      deckId: DECK,
      fields: { front: "cat", back: "gato" },
      tags: [],
    });
    clock.advance(10);
    const edited = await repos.notes.edit(note.id, {
      fields: { front: "dog", back: "cão" },
      tags: ["x"],
    });
    expect(edited).toMatchObject({
      fields: { front: "dog", back: "cão" },
      tags: ["x"],
      sortField: "dog",
      checksum: await sha256Hex("dog"),
      updatedAt: T0 + 10,
    });
    expect(await db.notes.get(note.id)).toEqual(edited);
  });

  it("adds, removes and restores cards as templates start or stop generating", async () => {
    const { note, cards } = await repos.notes.add({
      noteTypeId: reversed.id,
      deckId: DECK,
      fields: { front: "cat", back: "gato" },
      tags: [],
    });
    const second = cards[1]?.id as string;
    await db.cards.update(second, { reps: 4 });
    await repos.notes.edit(note.id, { fields: { front: "cat", back: "" }, tags: [] });
    expect(await activeCards(note.id)).toEqual([0]);
    await repos.notes.edit(note.id, { fields: { front: "cat", back: "gato" }, tags: [] });
    expect(await activeCards(note.id)).toEqual([0, 1]);
    expect(await db.cards.get(second)).toMatchObject({ deletedAt: null, reps: 4 });
  });

  it("puts new cards in the deck of the note's existing cards", async () => {
    const { note } = await repos.notes.add({
      noteTypeId: cloze.id,
      deckId: DECK,
      fields: { text: "{{c1::a}}" },
      tags: [],
    });
    await repos.notes.edit(note.id, { fields: { text: "{{c1::a}} {{c2::b}}" }, tags: [] });
    const cards = await db.cards.where("noteId").equals(note.id).toArray();
    expect(cards.map((c) => [c.templateOrd, c.deckId])).toEqual([
      [0, DECK],
      [1, DECK],
    ]);
  });

  it("refuses an edit that would leave the note without cards", async () => {
    const { note } = await repos.notes.add({
      noteTypeId: reversed.id,
      deckId: DECK,
      fields: { front: "cat" },
      tags: [],
    });
    await expect(repos.notes.edit(note.id, { fields: { front: "" }, tags: [] })).rejects.toEqual(
      new NoteOperationError("no-cards"),
    );
    expect((await db.notes.get(note.id))?.fields).toEqual({ front: "cat" });
  });

  it("refuses an unknown note", async () => {
    await expect(repos.notes.edit(DECK, { fields: {}, tags: [] })).rejects.toEqual(
      new NoteOperationError("not-found"),
    );
  });
});

describe("notes.duplicatesOf", () => {
  it("finds active notes of the same type with the same first field text", async () => {
    const add = (noteTypeId: string, fields: Record<string, string>) =>
      repos.notes.add({ noteTypeId, deckId: DECK, fields, tags: [] });
    const cat = await add(reversed.id, { front: "<i>cat</i>", back: "gato" });
    await add(cloze.id, { text: "{{c1::x}}", extra: "" });
    const gone = await add(reversed.id, { front: "cat", back: "felino" });
    await repos.notes.softDelete(gone.note.id);
    const found = await repos.notes.duplicatesOf(reversed.id, "cat");
    expect(found.map((n) => n.id)).toEqual([cat.note.id]);
    expect(await repos.notes.duplicatesOf(reversed.id, "cat", cat.note.id)).toEqual([]);
    expect(await repos.notes.duplicatesOf(reversed.id, "  ")).toEqual([]);
  });
});
