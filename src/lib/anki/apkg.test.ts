import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { strToU8, zipSync } from "fflate";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { readApkg, type SqlJs } from "./apkg";

const require = createRequire(import.meta.url);
const sqlDist = dirname(require.resolve("sql.js/dist/sql-wasm.wasm"));
let SQL: SqlJs;

beforeAll(async () => {
  SQL = await initSqlJs({ locateFile: (file: string) => join(sqlDist, file) });
});

const fixture = () => new Uint8Array(readFileSync("tests/fixtures/anki/legacy.apkg"));

describe("readApkg", () => {
  it("reads a legacy export: collection, notes, cards, review log and media", () => {
    const result = readApkg(fixture(), SQL);
    if (result.format !== "anki") throw new Error(`unexpected format ${result.format}`);
    const { collection, media } = result;
    expect(collection.col.crt).toBe(1_700_000_000);
    expect(Object.keys(JSON.parse(collection.col.models))).toHaveLength(2);
    expect(collection.notes).toHaveLength(4);
    expect(collection.notes[0]).toMatchObject({ guid: "Gk8&cat", tags: " animais Ingles " });
    expect(collection.notes[0]?.flds.split("\x1f")).toEqual(["cat", 'gato <img src="gato.png">']);
    expect(collection.cards).toHaveLength(5);
    expect(collection.cards[0]).toMatchObject({ type: 2, queue: 2, ivl: 10, reps: 5, lapses: 1 });
    expect(collection.revlog).toHaveLength(4);
    expect(media.map((m) => m.name)).toEqual(["gato.png"]);
    expect([...(media[0]?.bytes.subarray(1, 4) ?? [])]).toEqual([0x50, 0x4e, 0x47]); // "PNG"
  });

  it("reads a current export (zstd SQLite schema 18, protobuf config, zstd media) into the same shape", () => {
    const result = readApkg(new Uint8Array(readFileSync("tests/fixtures/anki/anki21b.apkg")), SQL);
    if (result.format !== "anki") throw new Error(`unexpected format ${result.format}`);
    const { collection, media } = result;
    expect(collection.col.crt).toBe(1_700_000_000);
    const models = JSON.parse(collection.col.models);
    expect(models["1600000000001"]).toEqual({
      id: 1_600_000_000_001,
      name: "Basic",
      type: 0,
      css: ".card { font-family: arial; font-size: 20px; text-align: center; }",
      flds: [
        { name: "Front", ord: 0, sticky: false, rtl: false },
        { name: "Back", ord: 1, sticky: false, rtl: false },
      ],
      tmpls: [
        {
          name: "Card 1",
          ord: 0,
          qfmt: "{{Front}}",
          afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
        },
      ],
    });
    expect(models["1600000000002"].type).toBe(1);
    const decks = JSON.parse(collection.col.decks);
    expect(decks["1700000000102"]).toEqual({
      id: 1_700_000_000_102,
      name: "Inglês\x1fAnimais",
      conf: 1_700_000_000_201,
      dyn: 0,
      collapsed: true,
    });
    expect(decks["1700000000103"]).toMatchObject({ dyn: 1 });
    const intenso = JSON.parse(collection.col.dconf)["1700000000201"];
    expect(intenso).toMatchObject({
      name: "Intenso",
      new: { perDay: 50, delays: [5, 30, 1440] },
      rev: { perDay: 500, maxIvl: 3650 },
      lapse: { delays: [15], leechFails: 6, leechAction: 0 },
    });
    expect(intenso.desiredRetention).toBeCloseTo(0.85, 5);
    expect(collection.notes).toHaveLength(4);
    expect(collection.cards).toHaveLength(5);
    expect(collection.revlog).toHaveLength(4);
    expect(media.map((m) => m.name)).toEqual(["gato.png"]);
    expect([...(media[0]?.bytes.subarray(1, 4) ?? [])]).toEqual([0x50, 0x4e, 0x47]);
  });

  it("refuses packages from a newer Anki package version than it knows", () => {
    const zip = zipSync({
      "collection.anki21b": new Uint8Array([1]),
      meta: new Uint8Array([8, 4]),
    });
    expect(readApkg(zip, SQL)).toEqual({ format: "unsupported" });
  });

  it("rejects files that are not Anki packages", () => {
    expect(readApkg(zipSync({ "x.txt": strToU8("hi") }), SQL)).toEqual({ format: "unknown" });
    expect(readApkg(strToU8("not a zip"), SQL)).toEqual({ format: "unknown" });
  });
});
