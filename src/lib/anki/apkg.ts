/**
 * Reads an Anki package (.apkg/.colpkg): unzip, open the SQLite collection with sql.js, return
 * plain rows. No mapping here — that is domain/import's job (docs/08-import-export.md).
 */
import { unzipSync } from "fflate";
import type { Database, SqlJsStatic } from "sql.js";

export type SqlJs = SqlJsStatic;

export interface RawCol {
  crt: number;
  models: string;
  decks: string;
  dconf: string;
}

export interface RawNote {
  id: number;
  guid: string;
  mid: number;
  mod: number;
  tags: string;
  flds: string;
}

export interface RawCard {
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
}

export interface RawRevlog {
  id: number;
  cid: number;
  ease: number;
  ivl: number;
  time: number;
  type: number;
}

export interface RawCollection {
  col: RawCol;
  notes: RawNote[];
  cards: RawCard[];
  revlog: RawRevlog[];
}

export interface MediaFile {
  name: string;
  bytes: Uint8Array;
}

export type ApkgContents =
  | { format: "legacy"; collection: RawCollection; media: MediaFile[] }
  | { format: "anki21b" }
  | { format: "unknown" };

function rows<T>(db: Database, sql: string): T[] {
  const [result] = db.exec(sql);
  if (!result) return [];
  return result.values.map(
    (values) => Object.fromEntries(result.columns.map((c, i) => [c, values[i]])) as T,
  );
}

export function readApkg(bytes: Uint8Array, SQL: SqlJs): ApkgContents {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { format: "unknown" };
  }
  if (files["collection.anki21b"]) return { format: "anki21b" };
  const sqlite = files["collection.anki21"] ?? files["collection.anki2"];
  if (!sqlite) return { format: "unknown" };

  const db = new SQL.Database(sqlite);
  try {
    const [col] = rows<RawCol>(db, "SELECT crt, models, decks, dconf FROM col LIMIT 1");
    if (!col) return { format: "unknown" };
    const collection: RawCollection = {
      col,
      notes: rows(db, "SELECT id, guid, mid, mod, tags, flds FROM notes ORDER BY id"),
      cards: rows(
        db,
        "SELECT id, nid, did, ord, mod, type, queue, due, ivl, factor, reps, lapses, left, odid, flags, data FROM cards ORDER BY id",
      ),
      revlog: rows(db, "SELECT id, cid, ease, ivl, time, type FROM revlog ORDER BY id"),
    };
    const map = files.media
      ? (JSON.parse(new TextDecoder().decode(files.media)) as Record<string, string>)
      : {};
    const media = Object.entries(map).flatMap(([key, name]) => {
      const file = files[key];
      return file ? [{ name, bytes: file }] : [];
    });
    return { format: "legacy", collection, media };
  } finally {
    db.close();
  }
}
