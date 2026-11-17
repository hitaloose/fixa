import Dexie, { type EntityTable } from "dexie";
import type { Card, Deck, Media, Note, NoteType, Preset, ReviewLog } from "../domain/model";
import { v1 } from "./schema/v1";
import { v2 } from "./schema/v2";
import { v3 } from "./schema/v3";

export interface AddHistoryEntry {
  id?: number;
  noteId: string;
  addedAt: number;
}

/** Browser handles (e.g. the automatic-backup folder); device-only, never in backups. */
export interface HandleRow {
  key: string;
  handle: unknown;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export type FixaDb = Dexie & {
  presets: EntityTable<Preset, "id">;
  decks: EntityTable<Deck, "id">;
  noteTypes: EntityTable<NoteType, "id">;
  notes: EntityTable<Note, "id">;
  cards: EntityTable<Card, "id">;
  reviewLogs: EntityTable<ReviewLog, "id">;
  media: EntityTable<Media, "id">;
  addHistory: EntityTable<AddHistoryEntry, "id">;
  settings: EntityTable<SettingRow, "key">;
  handles: EntityTable<HandleRow, "key">;
};

export function createDb(name: string): FixaDb {
  const db = new Dexie(name) as FixaDb;
  db.version(1).stores(v1);
  db.version(2).stores(v2);
  db.version(3).stores(v3);
  return db;
}
