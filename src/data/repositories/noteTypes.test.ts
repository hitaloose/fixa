import { beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import type { NoteType } from "../../domain/model";
import { addTemplate, removeTemplate, renameField } from "../../domain/notetypes";
import { fixedClock } from "../../lib/clock";
import type { FixaDb } from "../db";
import { ensureSeed, SEED_IDS } from "../seed";
import { createRepositories } from "./index";

const LABELS = {
  presetName: "Padrão",
  basic: "Básico",
  basicReversed: "Básico (e invertido)",
  cloze: "Omissão",
  front: "Frente",
  back: "Verso",
  text: "Texto",
  extra: "Verso extra",
  card: (n: number) => `Cartão ${n}`,
};
const T = 1_800_000_000_000;
let db: FixaDb;
let repos: ReturnType<typeof createRepositories>;
let deckId: string;
let n = 0;
const ids = { next: () => `00000000-0000-7000-9000-${(++n).toString(16).padStart(12, "0")}` };

beforeEach(async () => {
  db = testDb();
  repos = createRepositories({ db, clock: fixedClock(T), ids });
  await ensureSeed({ db, clock: fixedClock(T) }, LABELS);
  deckId = (await repos.decks.createByPath("Inglês", SEED_IDS.preset)).id;
});

const basicReversed = async () => (await db.noteTypes.get(SEED_IDS.basicReversed)) as NoteType;
const activeOrds = async (noteId: string) =>
  (await db.cards.where("noteId").equals(noteId).toArray())
    .filter((c) => c.deletedAt === null)
    .map((c) => c.templateOrd)
    .sort();

describe("noteTypes.saveEdited", () => {
  it("saves renamed fields and templates", async () => {
    const edited = renameField(await basicReversed(), "back", "Resposta");
    await repos.noteTypes.saveEdited(edited);
    expect((await basicReversed()).fields.map((f) => f.name)).toEqual(["Frente", "Resposta"]);
  });

  it("removing a card type deletes its cards and re-numbers the others", async () => {
    const { note } = await repos.notes.add({
      noteTypeId: SEED_IDS.basicReversed,
      deckId,
      fields: { front: "cat", back: "gato" },
      tags: [],
    });
    const nt = await basicReversed();
    const second = (await db.cards.where("noteId").equals(note.id).toArray()).find(
      (c) => c.templateOrd === 1,
    );
    await repos.noteTypes.saveEdited(removeTemplate(nt, nt.templates[0]?.id ?? ""));
    expect(await activeOrds(note.id)).toEqual([0]);
    expect((await db.cards.get(second?.id ?? ""))?.templateOrd).toBe(0);
  });

  it("adding a card type creates its cards for existing notes", async () => {
    const { note } = await repos.notes.add({
      noteTypeId: SEED_IDS.basic,
      deckId,
      fields: { front: "cat", back: "gato" },
      tags: [],
    });
    const basic = (await db.noteTypes.get(SEED_IDS.basic)) as NoteType;
    await repos.noteTypes.saveEdited(addTemplate(basic, "Cartão 2", ids));
    expect(await activeOrds(note.id)).toEqual([0, 1]);
    expect(
      (await db.cards.where("noteId").equals(note.id).toArray()).every((c) => c.deckId === deckId),
    ).toBe(true);
  });
});

describe("noteTypes.cloneFrom / remove", () => {
  it("clones a note type under a new name", async () => {
    const clone = await repos.noteTypes.cloneFrom(SEED_IDS.basic, "Vocabulário");
    expect(clone).toMatchObject({ name: "Vocabulário", kind: "standard" });
    expect(clone.id).not.toBe(SEED_IDS.basic);
  });

  it("removes an unused note type but not one with notes", async () => {
    const clone = await repos.noteTypes.cloneFrom(SEED_IDS.basic, "Vocabulário");
    await repos.noteTypes.remove(clone.id);
    expect((await db.noteTypes.get(clone.id))?.deletedAt).toBe(T);
    await repos.notes.add({ noteTypeId: SEED_IDS.basic, deckId, fields: { front: "x" }, tags: [] });
    await expect(repos.noteTypes.remove(SEED_IDS.basic)).rejects.toThrow("note type is in use");
  });
});
