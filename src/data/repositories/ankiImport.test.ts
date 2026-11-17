import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { readApkg, type SqlJs } from "../../lib/anki/apkg";
import { fixedClock } from "../../lib/clock";
import { ensureSeed } from "../seed";
import { createRepositories } from "./index";

const require = createRequire(import.meta.url);
let SQL: SqlJs;
beforeAll(async () => {
  const dist = dirname(require.resolve("sql.js/dist/sql-wasm.wasm"));
  SQL = await initSqlJs({ locateFile: (f: string) => join(dist, f) });
});

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

async function setup() {
  const db = testDb();
  const clock = fixedClock(1_800_000_000_000);
  let n = 0;
  const ids = { next: () => `00000000-0000-7000-9000-${(++n).toString(16).padStart(12, "0")}` };
  await ensureSeed({ db, clock }, LABELS);
  return { db, repos: createRepositories({ db, clock, ids }) };
}

function fixture(file = "legacy.apkg") {
  const contents = readApkg(new Uint8Array(readFileSync(`tests/fixtures/anki/${file}`)), SQL);
  if (contents.format !== "anki") throw new Error(`${file} could not be read`);
  return contents;
}

describe("ankiImport.importCollection", () => {
  it("imports decks, note types, notes, cards, history and media from a real package", async () => {
    const { db, repos } = await setup();
    const { collection, media } = fixture();
    const summary = await repos.ankiImport.importCollection(collection, media);
    expect(summary).toEqual({
      decks: 2,
      noteTypes: 2,
      notes: 4,
      cards: 5,
      skippedNotes: 0,
      media: 1,
    });

    const decks = await db.decks.toArray();
    expect(decks.map((d) => d.name).sort()).toEqual(["Animais", "Inglês"]);
    const cat = (await db.notes.toArray()).find((n) => n.guid === "Gk8&cat");
    const stored = await db.media.toArray();
    expect(cat?.fields.f1).toBe(`gato <img src="${stored[0]?.fileName}">`);
    expect(cat?.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(await db.reviewLogs.count()).toBe(4);
    expect((await db.cards.toArray()).filter((c) => c.queue === "suspended")).toHaveLength(1);
    expect((await db.presets.toArray()).map((p) => p.name).sort()).toEqual(["Intenso", "Padrão"]);
  });

  it("does not duplicate anything when the same package is imported again", async () => {
    const { db, repos } = await setup();
    const { collection, media } = fixture();
    await repos.ankiImport.importCollection(collection, media);
    const again = await repos.ankiImport.importCollection(collection, media);
    expect(again).toEqual({
      decks: 0,
      noteTypes: 0,
      notes: 0,
      cards: 0,
      skippedNotes: 4,
      media: 1,
    });
    expect(await db.notes.count()).toBe(4);
    expect(await db.decks.count()).toBe(2);
    expect(await db.media.count()).toBe(1);
  });

  it("imports a current-format package exactly like the legacy one", async () => {
    const legacy = await setup();
    const current = await setup();
    const a = fixture("legacy.apkg");
    const b = fixture("anki21b.apkg");
    const summaryA = await legacy.repos.ankiImport.importCollection(a.collection, a.media);
    const summaryB = await current.repos.ankiImport.importCollection(b.collection, b.media);
    expect(summaryB).toEqual(summaryA);
    const shape = async (db: typeof legacy.db) => ({
      decks: (await db.decks.toArray()).map((d) => [d.name, d.collapsed]).sort(),
      notes: (await db.notes.toArray()).map((n) => [n.guid, Object.values(n.fields)]).sort(),
      cards: (await db.cards.toArray()).map((c) => [c.queue, c.due, c.reps, c.flag]).sort(),
      presets: (await db.presets.toArray())
        .map((p) => [p.name, p.learningSteps, p.newPerDay])
        .sort(),
    });
    expect(await shape(current.db)).toEqual(await shape(legacy.db));
  });

  it("refuses a collection it cannot read", async () => {
    const { repos } = await setup();
    await expect(repos.ankiImport.importCollection({ col: {} }, [])).rejects.toMatchObject({
      name: "AnkiImportError",
      code: "invalid",
    });
  });
});
