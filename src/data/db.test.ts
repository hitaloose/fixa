import { describe, expect, it } from "vitest";
import { testDb } from "../../tests/db";

describe("createDb (schema v1)", () => {
  it("creates every table from docs/04-modelo-de-dados.md", async () => {
    const db = testDb();
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      "addHistory",
      "cards",
      "decks",
      "media",
      "noteTypes",
      "notes",
      "presets",
      "reviewLogs",
      "settings",
    ]);
  });

  it("indexes cards for queue counts and new-card order", async () => {
    const db = testDb();
    await db.open();
    const indexes = db.cards.schema.indexes.map((i) => i.name);
    expect(indexes).toEqual(
      expect.arrayContaining([
        "noteId",
        "deckId",
        "[deckId+queue+due]",
        "[deckId+queue+newPosition]",
      ]),
    );
  });

  it("indexes notes by tag (multi-entry) and checksum", async () => {
    const db = testDb();
    await db.open();
    const notes = db.notes.schema.indexes;
    expect(notes.find((i) => i.name === "tags")?.multi).toBe(true);
    expect(notes.map((i) => i.name)).toContain("checksum");
  });

  it("is at version 1", async () => {
    const db = testDb();
    await db.open();
    expect(db.verno).toBe(1);
  });
});
