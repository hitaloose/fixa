import Dexie, { type EntityTable } from "dexie";
import type { Card, Deck, Media, Note, NoteType, Preset, ReviewLog } from "../domain/model";
import { v1 } from "./schema/v1";

export interface AddHistoryEntry {
  id?: number;
  noteId: string;
  addedAt: number;
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
};

export function createDb(name: string): FixaDb {
  const db = new Dexie(name) as FixaDb;
  db.version(1).stores(v1);
  return db;
}
