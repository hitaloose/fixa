/**
 * Writes an Anki package in the legacy format (collection.anki2, schema 11, JSON media map):
 * the one every Anki version imports (docs/08-import-export.md › Exportar .apkg).
 */
import { strToU8, zipSync } from "fflate";
import type { SqlJs } from "./apkg";

export interface ApkgRows {
  col: { crt: number; models: string; decks: string; dconf: string };
  notes: Array<{
    id: number;
    guid: string;
    mid: number;
    mod: number;
    tags: string;
    flds: string;
    sfld: string;
    csum: number;
  }>;
  cards: Array<{
    id: number;
    nid: number;
    did: number;
    ord: number;
    mod: number;
    type: number;
    queue: number;
    due: number;
    ivl: number;
    factor: number;
    reps: number;
    lapses: number;
    left: number;
    odid: number;
    flags: number;
    data: string;
  }>;
  revlog: Array<{
    id: number;
    cid: number;
    ease: number;
    ivl: number;
    lastIvl: number;
    factor: number;
    time: number;
    type: number;
  }>;
}

const SCHEMA = `
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
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`;

export function writeApkg(
  rows: ApkgRows,
  media: Array<{ name: string; bytes: Uint8Array }>,
  SQL: SqlJs,
): Uint8Array {
  const db = new SQL.Database();
  try {
    db.run(SCHEMA);
    const now = Date.now();
    db.run("INSERT INTO col VALUES (1,?,?,?,11,0,0,0,?,?,?,?,'{}')", [
      rows.col.crt,
      now,
      now,
      JSON.stringify({
        nextPos: rows.cards.length + 1,
        curDeck: 1,
        sortType: "noteFld",
        schedVer: 2,
      }),
      rows.col.models,
      rows.col.decks,
      rows.col.dconf,
    ]);
    for (const n of rows.notes) {
      db.run("INSERT INTO notes VALUES (?,?,?,?,-1,?,?,?,?,0,'')", [
        n.id,
        n.guid,
        n.mid,
        n.mod,
        n.tags,
        n.flds,
        n.sfld,
        n.csum,
      ]);
    }
    for (const c of rows.cards) {
      db.run("INSERT INTO cards VALUES (?,?,?,?,?,-1,?,?,?,?,?,?,?,?,0,?,?,?)", [
        c.id,
        c.nid,
        c.did,
        c.ord,
        c.mod,
        c.type,
        c.queue,
        c.due,
        c.ivl,
        c.factor,
        c.reps,
        c.lapses,
        c.left,
        c.odid,
        c.flags,
        c.data,
      ]);
    }
    for (const r of rows.revlog) {
      db.run("INSERT INTO revlog VALUES (?,?,-1,?,?,?,?,?,?)", [
        r.id,
        r.cid,
        r.ease,
        r.ivl,
        r.lastIvl,
        r.factor,
        r.time,
        r.type,
      ]);
    }
    const files: Record<string, Uint8Array> = { "collection.anki2": db.export() };
    const map: Record<string, string> = {};
    media.forEach((m, i) => {
      files[String(i)] = m.bytes;
      map[String(i)] = m.name;
    });
    files.media = strToU8(JSON.stringify(map));
    return zipSync(files);
  } finally {
    db.close();
  }
}
