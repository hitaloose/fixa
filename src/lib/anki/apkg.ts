/**
 * Reads an Anki package (.apkg/.colpkg): unzip, open the SQLite collection with sql.js, return
 * plain rows. No mapping here — that is domain/import's job (docs/08-import-export.md).
 */
import { unzipSync } from "fflate";
import { decompress } from "fzstd";
import type { Database, SqlJsStatic } from "sql.js";
import {
  decodeProto,
  protoBool,
  protoFloat,
  protoFloats,
  protoMessage,
  protoMessages,
  protoNumber,
  protoString,
} from "./protobuf";

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
  | { format: "anki"; collection: RawCollection; media: MediaFile[] }
  /** A package version newer than the ones this reader knows. */
  | { format: "unsupported" }
  | { format: "unknown" };

/** PackageMetadata.Version: 1 legacy (anki2), 2 legacy (anki21), 3 latest (anki21b). */
const LATEST_PACKAGE_VERSION = 3;
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];
const isZstd = (b: Uint8Array) => ZSTD_MAGIC.every((byte, i) => b[i] === byte);
const unzstd = (b: Uint8Array) => (isZstd(b) ? decompress(b) : b);

function rows<T>(db: Database, sql: string): T[] {
  const [result] = db.exec(sql);
  if (!result) return [];
  return result.values.map(
    (values) => Object.fromEntries(result.columns.map((c, i) => [c, values[i]])) as T,
  );
}

const NOTES_SQL = "SELECT id, guid, mid, mod, tags, flds FROM notes ORDER BY id";
const CARDS_SQL =
  "SELECT id, nid, did, ord, mod, type, queue, due, ivl, factor, reps, lapses, left, odid, flags, data FROM cards ORDER BY id";
const REVLOG_SQL = "SELECT id, cid, ease, ivl, time, type FROM revlog ORDER BY id";

/** Schema 18 keeps note types, decks and options in tables with protobuf blobs: rebuild the
 * legacy JSON shape so the import mapping reads both formats the same way. */
function legacyJsonFromTables(db: Database): Pick<RawCol, "models" | "decks" | "dconf"> {
  const blob = (v: unknown) => (v instanceof Uint8Array ? v : new Uint8Array());
  const models: Record<string, unknown> = {};
  for (const nt of rows<{ id: number; name: string; config: unknown }>(
    db,
    "SELECT id, name, config FROM notetypes",
  )) {
    const config = decodeProto(blob(nt.config));
    const fields = rows<{ ord: number; name: string; config: unknown }>(
      db,
      `SELECT ord, name, config FROM fields WHERE ntid = ${Number(nt.id)} ORDER BY ord`,
    ).map((f) => {
      const c = decodeProto(blob(f.config));
      return { name: f.name, ord: f.ord, sticky: protoBool(c, 1), rtl: protoBool(c, 2) };
    });
    const templates = rows<{ ord: number; name: string; config: unknown }>(
      db,
      `SELECT ord, name, config FROM templates WHERE ntid = ${Number(nt.id)} ORDER BY ord`,
    ).map((t) => {
      const c = decodeProto(blob(t.config));
      return { name: t.name, ord: t.ord, qfmt: protoString(c, 1), afmt: protoString(c, 2) };
    });
    models[String(nt.id)] = {
      id: nt.id,
      name: nt.name,
      type: protoNumber(config, 1),
      css: protoString(config, 3),
      flds: fields,
      tmpls: templates,
    };
  }

  const decks: Record<string, unknown> = {};
  for (const d of rows<{ id: number; name: string; common: unknown; kind: unknown }>(
    db,
    "SELECT id, name, common, kind FROM decks",
  )) {
    const kind = decodeProto(blob(d.kind));
    const normal = protoMessage(kind, 1);
    decks[String(d.id)] = {
      id: d.id,
      name: d.name,
      ...(normal ? { conf: protoNumber(normal, 1) } : {}),
      dyn: normal ? 0 : 1,
      collapsed: protoBool(decodeProto(blob(d.common)), 1),
    };
  }

  const dconf: Record<string, unknown> = {};
  for (const c of rows<{ id: number; name: string; config: unknown }>(
    db,
    "SELECT id, name, config FROM deck_config",
  )) {
    const config = decodeProto(blob(c.config));
    const retention = protoFloat(config, 37);
    dconf[String(c.id)] = {
      id: c.id,
      name: c.name,
      new: { perDay: protoNumber(config, 9), delays: protoFloats(config, 1) },
      rev: { perDay: protoNumber(config, 10), maxIvl: protoNumber(config, 16) || 36_500 },
      lapse: {
        delays: protoFloats(config, 2),
        leechFails: protoNumber(config, 22),
        leechAction: protoNumber(config, 21),
      },
      ...(retention ? { desiredRetention: retention } : {}),
    };
  }
  return {
    models: JSON.stringify(models),
    decks: JSON.stringify(decks),
    dconf: JSON.stringify(dconf),
  };
}

function readMedia(files: Record<string, Uint8Array>): MediaFile[] {
  const raw = files.media;
  if (!raw) return [];
  const pick = (key: string, name: string) => {
    const file = files[key];
    return file ? [{ name, bytes: unzstd(file) }] : [];
  };
  try {
    const map = JSON.parse(new TextDecoder().decode(raw)) as Record<string, string>;
    return Object.entries(map).flatMap(([key, name]) => pick(key, name));
  } catch {
    // Current packages: zstd-compressed protobuf MediaEntries; files are named by position.
    const entries = protoMessages(decodeProto(unzstd(raw)), 1);
    return entries.flatMap((entry, i) => pick(String(i), protoString(entry, 1)));
  }
}

export function readApkg(bytes: Uint8Array, SQL: SqlJs): ApkgContents {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { format: "unknown" };
  }
  const meta = files.meta;
  const version = meta ? protoNumber(decodeProto(meta), 1) : 0;
  if (version > LATEST_PACKAGE_VERSION) return { format: "unsupported" };

  const current = files["collection.anki21b"];
  const sqlite = current
    ? unzstd(current)
    : (files["collection.anki21"] ?? files["collection.anki2"]);
  if (!sqlite) return { format: "unknown" };

  let db: Database;
  try {
    db = new SQL.Database(sqlite);
  } catch {
    return { format: "unknown" };
  }
  try {
    const [col] = rows<RawCol>(db, "SELECT crt, models, decks, dconf FROM col LIMIT 1");
    if (!col) return { format: "unknown" };
    const collection: RawCollection = {
      col: current ? { crt: col.crt, ...legacyJsonFromTables(db) } : col,
      notes: rows(db, NOTES_SQL),
      cards: rows(db, CARDS_SQL),
      revlog: rows(db, REVLOG_SQL),
    };
    return { format: "anki", collection, media: readMedia(files) };
  } catch {
    return { format: "unknown" };
  } finally {
    db.close();
  }
}
