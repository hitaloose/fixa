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
    if (result.format !== "legacy") throw new Error(`unexpected format ${result.format}`);
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

  it("recognises the newer compressed format without reading it", () => {
    const zip = zipSync({
      "collection.anki21b": new Uint8Array([1, 2, 3]),
      media: new Uint8Array(),
    });
    expect(readApkg(zip, SQL)).toEqual({ format: "anki21b" });
  });

  it("rejects files that are not Anki packages", () => {
    expect(readApkg(zipSync({ "x.txt": strToU8("hi") }), SQL)).toEqual({ format: "unknown" });
    expect(readApkg(strToU8("not a zip"), SQL)).toEqual({ format: "unknown" });
  });
});
