import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { unzipSync } from "fflate";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { readApkg, type SqlJs } from "./apkg";
import { type ApkgRows, writeApkg } from "./writeApkg";

const require = createRequire(import.meta.url);
let SQL: SqlJs;
beforeAll(async () => {
  SQL = await initSqlJs({
    locateFile: (f: string) => join(dirname(require.resolve("sql.js/dist/sql-wasm.wasm")), f),
  });
});

const rows: ApkgRows = {
  col: {
    crt: 1_700_000_000,
    models: '{"1":{"id":1}}',
    decks: '{"1":{"id":1,"name":"Default"}}',
    dconf: '{"1":{"id":1}}',
  },
  notes: [
    { id: 10, guid: "abc", mid: 1, mod: 5, tags: " a ", flds: "x\x1fy", sfld: "x", csum: 123 },
  ],
  cards: [
    {
      id: 20,
      nid: 10,
      did: 1,
      ord: 0,
      mod: 5,
      type: 0,
      queue: 0,
      due: 1,
      ivl: 0,
      factor: 0,
      reps: 0,
      lapses: 0,
      left: 0,
      odid: 0,
      flags: 0,
      data: "",
    },
  ],
  revlog: [{ id: 30, cid: 20, ease: 3, ivl: 1, lastIvl: 0, factor: 2500, time: 4000, type: 0 }],
};

describe("writeApkg", () => {
  it("writes a legacy package that the reader reads back", () => {
    const zip = writeApkg(rows, [{ name: "a.png", bytes: new Uint8Array([1, 2, 3]) }], SQL);
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(["0", "collection.anki2", "media"]);
    const back = readApkg(zip, SQL);
    if (back.format !== "anki") throw new Error("not readable");
    expect(back.collection.col).toEqual(rows.col);
    expect(back.collection.notes).toEqual([
      { id: 10, guid: "abc", mid: 1, mod: 5, tags: " a ", flds: "x\x1fy" },
    ]);
    expect(back.collection.cards).toEqual(rows.cards);
    expect(back.collection.revlog).toEqual([
      { id: 30, cid: 20, ease: 3, ivl: 1, time: 4000, type: 0 },
    ]);
    expect(back.media).toEqual([{ name: "a.png", bytes: new Uint8Array([1, 2, 3]) }]);
  });
});
