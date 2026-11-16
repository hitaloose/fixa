import { describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { makeCard, makeNote } from "../../../tests/factories";
import { fixedClock } from "../../lib/clock";
import { createRepositories } from "./index";

const PRESET = "00000000-0000-7000-a000-000000000001";
const T0 = 5_000_000;

function setup() {
  const db = testDb();
  const clock = fixedClock(T0);
  // IDs in a separate range from factory IDs
  const ids = {
    next: (() => {
      let n = 0;
      return () => `00000000-0000-7000-9000-${(++n).toString(16).padStart(12, "0")}`;
    })(),
  };
  return { db, clock, decks: createRepositories({ db, clock, ids }).decks };
}

describe("decks.createByPath", () => {
  it("creates a top-level deck", async () => {
    const { decks } = setup();
    const deck = await decks.createByPath("Inglês", PRESET);
    expect(deck).toMatchObject({ name: "Inglês", parentId: null, presetId: PRESET, createdAt: T0 });
    expect((await decks.listActive()).map((d) => d.name)).toEqual(["Inglês"]);
  });

  it("creates missing ancestors and returns the leaf", async () => {
    const { decks } = setup();
    const leaf = await decks.createByPath("Inglês::Phrasal verbs::Up", PRESET);
    const all = await decks.listActive();
    const byName = Object.fromEntries(all.map((d) => [d.name, d]));
    expect(leaf.name).toBe("Up");
    expect(byName["Phrasal verbs"]?.parentId).toBe(byName.Inglês?.id);
    expect(leaf.parentId).toBe(byName["Phrasal verbs"]?.id);
  });

  it("reuses existing ancestors", async () => {
    const { decks } = setup();
    const ingles = await decks.createByPath("Inglês", PRESET);
    const child = await decks.createByPath("inglês::Idioms", PRESET);
    expect(child.parentId).toBe(ingles.id);
    expect(await decks.listActive()).toHaveLength(2);
  });

  it("refuses a path that already exists", async () => {
    const { decks } = setup();
    await decks.createByPath("Inglês::Idioms", PRESET);
    await expect(decks.createByPath("Inglês::idioms", PRESET)).rejects.toMatchObject({
      code: "exists",
    });
  });

  it("refuses a path with an empty segment and creates nothing", async () => {
    const { decks } = setup();
    await expect(decks.createByPath("Inglês::", PRESET)).rejects.toMatchObject({
      code: "invalid-name",
    });
    expect(await decks.listActive()).toEqual([]);
  });

  it("ignores deleted decks when resolving the path", async () => {
    const { decks } = setup();
    const old = await decks.createByPath("Inglês", PRESET);
    await decks.deleteWithSubtree(old.id);
    const fresh = await decks.createByPath("Inglês", PRESET);
    expect(fresh.id).not.toBe(old.id);
  });
});

describe("decks.rename", () => {
  it("renames the deck node, trimming spaces", async () => {
    const { clock, decks } = setup();
    const deck = await decks.createByPath("Ingles", PRESET);
    clock.advance(10);
    expect(await decks.rename(deck.id, "  Inglês ")).toMatchObject({
      name: "Inglês",
      updatedAt: T0 + 10,
    });
  });

  it("refuses a name used by a sibling", async () => {
    const { decks } = setup();
    await decks.createByPath("Inglês::Idioms", PRESET);
    const other = await decks.createByPath("Inglês::Phrasal", PRESET);
    await expect(decks.rename(other.id, "IDIOMS")).rejects.toMatchObject({ code: "name-taken" });
  });

  it.each(["", "  ", "A::B"])("refuses the name %j", async (name) => {
    const { decks } = setup();
    const deck = await decks.createByPath("Inglês", PRESET);
    await expect(decks.rename(deck.id, name)).rejects.toMatchObject({ code: "invalid-name" });
  });
});

describe("decks.move", () => {
  it("moves a deck under another parent or to the top level", async () => {
    const { decks } = setup();
    const math = await decks.createByPath("Matemática", PRESET);
    const idioms = await decks.createByPath("Inglês::Idioms", PRESET);
    expect((await decks.move(idioms.id, math.id)).parentId).toBe(math.id);
    expect((await decks.move(idioms.id, null)).parentId).toBeNull();
  });

  it("refuses moving a deck into its own subtree", async () => {
    const { decks } = setup();
    const leaf = await decks.createByPath("Inglês::Idioms", PRESET);
    const ingles = (await decks.listActive()).find((d) => d.name === "Inglês");
    await expect(decks.move(ingles?.id ?? "", leaf.id)).rejects.toMatchObject({ code: "cycle" });
  });

  it("refuses when the target already has a child with that name", async () => {
    const { decks } = setup();
    await decks.createByPath("Matemática::Idioms", PRESET);
    const idioms = await decks.createByPath("Inglês::Idioms", PRESET);
    const math = (await decks.listActive()).find((d) => d.name === "Matemática");
    await expect(decks.move(idioms.id, math?.id ?? null)).rejects.toMatchObject({
      code: "name-taken",
    });
  });
});

describe("decks.setCollapsed", () => {
  it("persists the collapsed state", async () => {
    const { decks } = setup();
    const deck = await decks.createByPath("Inglês", PRESET);
    await decks.setCollapsed(deck.id, true);
    expect((await decks.get(deck.id))?.collapsed).toBe(true);
  });
});

describe("decks.deleteWithSubtree", () => {
  it("soft-deletes the deck, its subdecks and their cards, leaving others alone", async () => {
    const { db, clock, decks } = setup();
    const leaf = await decks.createByPath("Inglês::Idioms", PRESET);
    const ingles = (await decks.listActive()).find((d) => d.name === "Inglês");
    const math = await decks.createByPath("Matemática", PRESET);
    const inLeaf = makeCard({ deckId: leaf.id });
    const inMath = makeCard({ deckId: math.id });
    await db.cards.bulkAdd([inLeaf, inMath]);
    clock.advance(99);
    await decks.deleteWithSubtree(ingles?.id ?? "");
    expect((await decks.listActive()).map((d) => d.name)).toEqual(["Matemática"]);
    expect(await db.cards.get(inLeaf.id)).toMatchObject({ deletedAt: T0 + 99, updatedAt: T0 + 99 });
    expect((await db.cards.get(inMath.id))?.deletedAt).toBeNull();
  });

  it("soft-deletes notes left without active cards, keeping notes that still have cards", async () => {
    const { db, decks } = setup();
    const gone = await decks.createByPath("Apagar", PRESET);
    const keep = await decks.createByPath("Manter", PRESET);
    const onlyHere = makeNote();
    const split = makeNote();
    await db.notes.bulkAdd([onlyHere, split]);
    await db.cards.bulkAdd([
      makeCard({ deckId: gone.id, noteId: onlyHere.id }),
      makeCard({ deckId: gone.id, noteId: split.id }),
      makeCard({ deckId: keep.id, noteId: split.id, templateOrd: 1 }),
    ]);
    await decks.deleteWithSubtree(gone.id);
    expect((await db.notes.get(onlyHere.id))?.deletedAt).toBe(T0);
    expect((await db.notes.get(split.id))?.deletedAt).toBeNull();
  });
});
