// Builds tests/fixtures/anki/anki21b.apkg: a current Anki export (collection.anki21b = zstd
// SQLite schema 18 with protobuf config blobs, zstd protobuf media map, zstd media files).
// Same content as legacy.apkg. Run: node tests/fixtures/anki/make-anki21b.mjs
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { zstdCompressSync } from "node:zlib";
import { strToU8, zipSync } from "fflate";
import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);
const SQL = await initSqlJs({
  locateFile: (f) => join(dirname(require.resolve("sql.js/dist/sql-wasm.wasm")), f),
});

// ---- minimal protobuf writer ----
const varint = (n) => {
  const out = [];
  let v = BigInt(n);
  do {
    let byte = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) byte |= 0x80;
    out.push(byte);
  } while (v > 0n);
  return out;
};
const key = (field, wire) => varint((field << 3) | wire);
const pb = (...parts) => Uint8Array.from(parts.flat());
const uint = (field, n) => (n ? [...key(field, 0), ...varint(n)] : []);
const bool = (field, b) => (b ? [...key(field, 0), 1] : []);
const bytes = (field, data) => [...key(field, 2), ...varint(data.length), ...data];
const str = (field, s) => (s ? bytes(field, [...strToU8(s)]) : []);
const msg = (field, inner) => bytes(field, [...inner]);
const f32 = (x) => [...new Uint8Array(new Float32Array([x]).buffer)];
const float = (field, x) => (x ? [...key(field, 5), ...f32(x)] : []);
const floats = (field, xs) => (xs.length ? bytes(field, xs.flatMap(f32)) : []);

const CRT = 1_700_000_000;
const DAY = 86_400;
const TODAY = 1_000;
const NOW = CRT + TODAY * DAY + 10 * 3600;
const BASIC = 1_600_000_000_001;
const CLOZE = 1_600_000_000_002;
const D_DEFAULT = 1;
const D_INGLES = 1_700_000_000_101;
const D_ANIMAIS = 1_700_000_000_102;
const D_FILTER = 1_700_000_000_103;
const C_DEFAULT = 1;
const C_INTENSO = 1_700_000_000_201;
const SEP = "\x1f";

const db = new SQL.Database();
db.run(`
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null,
  ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null,
  models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null,
  usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null,
  flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null,
  mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null,
  ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null,
  odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null,
  ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE notetypes (id integer not null primary key, name text not null, mtime_secs integer not null,
  usn integer not null, config blob not null);
CREATE TABLE fields (ntid integer not null, ord integer not null, name text not null, config blob not null,
  primary key (ntid, ord));
CREATE TABLE templates (ntid integer not null, ord integer not null, name text not null, mtime_secs integer not null,
  usn integer not null, config blob not null, primary key (ntid, ord));
CREATE TABLE decks (id integer primary key not null, name text not null, mtime_secs integer not null,
  usn integer not null, common blob not null, kind blob not null);
CREATE TABLE deck_config (id integer primary key not null, name text not null, mtime_secs integer not null,
  usn integer not null, config blob not null);
`);
db.run("INSERT INTO col VALUES (1,?,?,?,18,0,0,0,'','','','','')", [CRT, NOW * 1000, NOW * 1000]);

db.run("INSERT INTO notetypes VALUES (?,?,?,0,?)", [
  BASIC,
  "Basic",
  CRT,
  pb(uint(1, 0), str(3, ".card { font-family: arial; font-size: 20px; text-align: center; }")),
]);
db.run("INSERT INTO notetypes VALUES (?,?,?,0,?)", [
  CLOZE,
  "Cloze",
  CRT,
  pb(
    uint(1, 1),
    str(3, ".card { font-family: arial; } .cloze { font-weight: bold; color: blue; }"),
  ),
]);
for (const [ntid, ord, name] of [
  [BASIC, 0, "Front"],
  [BASIC, 1, "Back"],
  [CLOZE, 0, "Text"],
  [CLOZE, 1, "Back Extra"],
]) {
  db.run("INSERT INTO fields VALUES (?,?,?,?)", [
    ntid,
    ord,
    name,
    pb(str(3, "Arial"), uint(4, 20)),
  ]);
}
db.run("INSERT INTO templates VALUES (?,?,?,?,0,?)", [
  BASIC,
  0,
  "Card 1",
  CRT,
  pb(str(1, "{{Front}}"), str(2, "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}")),
]);
db.run("INSERT INTO templates VALUES (?,?,?,?,0,?)", [
  CLOZE,
  0,
  "Cloze",
  CRT,
  pb(str(1, "{{cloze:Text}}"), str(2, "{{cloze:Text}}<br>\n{{Back Extra}}")),
]);

const normal = (configId) => pb(msg(1, pb(uint(1, configId))));
db.run("INSERT INTO decks VALUES (?,?,?,0,?,?)", [
  D_DEFAULT,
  "Default",
  CRT,
  pb(),
  normal(C_DEFAULT),
]);
db.run("INSERT INTO decks VALUES (?,?,?,0,?,?)", [
  D_INGLES,
  "Inglês",
  CRT,
  pb(),
  normal(C_DEFAULT),
]);
db.run("INSERT INTO decks VALUES (?,?,?,0,?,?)", [
  D_ANIMAIS,
  `Inglês${SEP}Animais`,
  CRT,
  pb(bool(1, true)),
  normal(C_INTENSO),
]);
db.run("INSERT INTO decks VALUES (?,?,?,0,?,?)", [
  D_FILTER,
  "Filtrado",
  CRT,
  pb(),
  pb(msg(2, pb(bool(1, true)))),
]);

db.run("INSERT INTO deck_config VALUES (?,?,?,0,?)", [
  C_DEFAULT,
  "Default",
  CRT,
  pb(
    floats(1, [1, 10]),
    floats(2, [10]),
    uint(9, 20),
    uint(10, 200),
    uint(16, 36500),
    uint(21, 1),
    uint(22, 8),
  ),
]);
db.run("INSERT INTO deck_config VALUES (?,?,?,0,?)", [
  C_INTENSO,
  "Intenso",
  CRT,
  pb(
    floats(1, [5, 30, 1440]),
    floats(2, [15]),
    uint(9, 50),
    uint(10, 500),
    uint(16, 3650),
    uint(21, 0),
    uint(22, 6),
    float(37, 0.85),
  ),
]);

const notes = [
  [1_700_000_001_001, "Gk8&cat", BASIC, " animais Ingles ", ["cat", 'gato <img src="gato.png">']],
  [1_700_000_001_002, "Gk8&dog", BASIC, "", ["dog", "cão"]],
  [
    1_700_000_001_003,
    "Gk8&brz",
    CLOZE,
    "geo",
    ["{{c1::Brasília}} é a capital do {{c2::Brasil}}", ""],
  ],
  [1_700_000_001_004, "Gk8&hlf", BASIC, "", ["\\(\\frac{1}{2}\\)", "metade"]],
];
for (const [nid, guid, mid, tags, flds] of notes) {
  db.run("INSERT INTO notes VALUES (?,?,?,?,-1,?,?,?,0,0,'')", [
    nid,
    guid,
    mid,
    NOW,
    tags,
    flds.join(SEP),
    flds[0],
  ]);
}
const cards = [
  [1_700_000_002_001, notes[0][0], D_ANIMAIS, 0, 2, 2, TODAY + 3, 10, 2500, 5, 1, 0, 0, 0],
  [1_700_000_002_002, notes[1][0], D_FILTER, 0, 0, 0, 2, 0, 0, 0, 0, 0, D_ANIMAIS, 0],
  [1_700_000_002_003, notes[2][0], D_INGLES, 0, 1, 1, NOW + 600, 0, 2500, 1, 0, 1001, 0, 1],
  [1_700_000_002_004, notes[2][0], D_INGLES, 1, 2, -1, TODAY - 5, 20, 2300, 7, 2, 0, 0, 0],
  [1_700_000_002_005, notes[3][0], D_INGLES, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
];
for (const [
  cid,
  nid,
  did,
  ord,
  type,
  queue,
  due,
  ivl,
  factor,
  reps,
  lapses,
  left,
  odid,
  flags,
] of cards) {
  db.run("INSERT INTO cards VALUES (?,?,?,?,?,-1,?,?,?,?,?,?,?,?,0,?,?,'')", [
    cid,
    nid,
    did,
    ord,
    NOW,
    type,
    queue,
    due,
    ivl,
    factor,
    reps,
    lapses,
    left,
    odid,
    flags,
  ]);
}
const revlog = [
  [(CRT + (TODAY - 30) * DAY) * 1000, cards[0][0], 3, -600, 8000, 0],
  [(CRT + (TODAY - 29) * DAY) * 1000, cards[0][0], 3, 4, 6000, 0],
  [(CRT + (TODAY - 7) * DAY) * 1000, cards[0][0], 4, 10, 4000, 1],
  [(CRT + TODAY * DAY) * 1000 + 1, cards[2][0], 3, -600, 5000, 0],
];
for (const [id, cid, ease, ivl, time, type] of revlog) {
  db.run("INSERT INTO revlog VALUES (?,?,-1,?,?,0,2500,?,?)", [id, cid, ease, ivl, time, type]);
}

const png = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c63f8cfc0f01f0005000201a0f2c7a20000000049454e44ae426082",
  "hex",
);
const mediaMap = pb(msg(1, pb(str(1, "gato.png"), uint(2, png.length))));
const zip = zipSync({
  "collection.anki2": strToU8(
    "Please update to the latest Anki version, then import the .colpkg/.apkg file again.",
  ),
  "collection.anki21b": new Uint8Array(zstdCompressSync(db.export())),
  meta: pb(uint(1, 3)),
  media: new Uint8Array(zstdCompressSync(mediaMap)),
  0: new Uint8Array(zstdCompressSync(png)),
});
const out = new URL("./anki21b.apkg", import.meta.url);
writeFileSync(out, zip);
console.log("wrote", out.pathname);
