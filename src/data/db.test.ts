import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { testDb } from "../../tests/db";
import { makeNote } from "../../tests/factories";
import { createDb } from "./db";
import { v1 as schemaV1 } from "./schema/v1";
import { v2 as schemaV2 } from "./schema/v2";

describe("createDb (tables from v1)", () => {
  it("creates every table from docs/04-modelo-de-dados.md", async () => {
    const db = testDb();
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      "addHistory",
      "cards",
      "decks",
      "handles",
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

  it("is at the latest schema version (3: folder handles for automatic backup)", async () => {
    const db = testDb();
    await db.open();
    expect(db.verno).toBe(3);
  });
});

describe("schema v2", () => {
  it("indexes notes by Anki guid, for re-import without duplicates", async () => {
    const db = testDb();
    await db.open();
    expect(db.notes.schema.indexes.map((i) => i.name)).toContain("guid");
  });

  it("upgrades a v1 database keeping its notes", async () => {
    const name = `fixa-migration-${Date.now()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores(schemaV1);
    const note = makeNote();
    await v1.table("notes").add(note);
    v1.close();
    const db = createDb(name);
    try {
      expect(await db.notes.get(note.id)).toEqual(note);
      expect(await db.notes.where("guid").equals("x").count()).toBe(0);
    } finally {
      await db.delete();
    }
  });
});

describe("schema v3", () => {
  it("adds a handles table and keeps v2 data", async () => {
    const name = `fixa-migration-v3-${Date.now()}`;
    const v2db = new Dexie(name);
    v2db.version(1).stores(schemaV1);
    v2db.version(2).stores(schemaV2);
    const note = makeNote({ guid: "g" });
    await v2db.table("notes").add(note);
    v2db.close();
    const db = createDb(name);
    try {
      expect(await db.notes.get(note.id)).toEqual(note);
      await db.handles.put({ key: "backupFolder", handle: { name: "Backups" } });
      expect(await db.handles.get("backupFolder")).toEqual({
        key: "backupFolder",
        handle: { name: "Backups" },
      });
    } finally {
      await db.delete();
    }
  });
});
