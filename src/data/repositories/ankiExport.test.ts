import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { readApkg, type SqlJs } from "../../lib/anki/apkg";
import { writeApkg } from "../../lib/anki/writeApkg";
import { fixedClock } from "../../lib/clock";
import { ensureSeed, SEED_IDS } from "../seed";
import { createRepositories } from "./index";

const require = createRequire(import.meta.url);
let SQL: SqlJs;
beforeAll(async () => {
  SQL = await initSqlJs({
    locateFile: (f: string) => join(dirname(require.resolve("sql.js/dist/sql-wasm.wasm")), f),
  });
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

async function device() {
  const db = testDb();
  const clock = fixedClock(1_800_000_000_000);
  let n = 0;
  const ids = { next: () => `00000000-0000-7000-9000-${(++n).toString(16).padStart(12, "0")}` };
  await ensureSeed({ db, clock }, LABELS);
  return { db, clock, repos: createRepositories({ db, clock, ids }) };
}

describe("ankiExport.buildPackage", () => {
  it("exports a deck with its subdecks, notes, cards and media, importable again", async () => {
    const a = await device();
    const ingles = await a.repos.decks.createByPath("Inglês::Animais", SEED_IDS.preset);
    const other = await a.repos.decks.createByPath("Matemática", SEED_IDS.preset);
    const image = await a.repos.media.storeFile(
      new Blob(["png"], { type: "image/png" }),
      "gato.png",
    );
    await a.repos.notes.add({
      noteTypeId: SEED_IDS.basic,
      deckId: ingles.id,
      fields: { front: "cat", back: `<img src="${image.fileName}">` },
      tags: ["animais"],
    });
    await a.repos.notes.add({
      noteTypeId: SEED_IDS.basic,
      deckId: other.id,
      fields: { front: "pi", back: "3,14" },
      tags: [],
    });
    const root = (await a.db.decks.toArray()).find((d) => d.name === "Inglês");

    const pkg = await a.repos.ankiExport.buildPackage(root?.id);
    expect(pkg.fileName).toBe("Inglês.apkg");
    expect(pkg.rows.notes).toHaveLength(1);
    expect(pkg.rows.notes[0]?.csum).toBe(0x9d989e8d); // sha1("cat")
    expect(pkg.media.map((m) => m.name)).toEqual([image.fileName]);

    const zip = writeApkg(pkg.rows, pkg.media, SQL);
    const read = readApkg(zip, SQL);
    if (read.format !== "anki") throw new Error("not readable");
    const b = await device();
    const summary = await b.repos.ankiImport.importCollection(read.collection, read.media);
    expect(summary).toMatchObject({ decks: 2, notes: 1, cards: 1, media: 1 });
    expect((await b.db.decks.toArray()).map((d) => d.name).sort()).toEqual(["Animais", "Inglês"]);
    expect((await b.db.notes.toArray())[0]).toMatchObject({
      fields: { front: "cat" },
      tags: ["animais"],
    });
  });

  it("exports everything when no deck is given", async () => {
    const a = await device();
    const deck = await a.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    await a.repos.notes.add({
      noteTypeId: SEED_IDS.basicReversed,
      deckId: deck.id,
      fields: { front: "cat", back: "gato" },
      tags: [],
    });
    const pkg = await a.repos.ankiExport.buildPackage();
    expect(pkg.fileName).toBe("fixa.apkg");
    expect(pkg.rows.cards).toHaveLength(2);
  });
});
