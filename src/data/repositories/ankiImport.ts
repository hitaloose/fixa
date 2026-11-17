import { type AnkiCollection, parseAnkiCollection, planAnkiImport } from "../../domain/import/anki";
import {
  parseCard,
  parseDeck,
  parseNote,
  parseNoteType,
  parsePreset,
  parseReviewLog,
} from "../../domain/model";
import type { Clock, IdGenerator } from "../../domain/ports";
import { sha256Hex } from "../../lib/hash";
import type { FixaDb } from "../db";
import { SEED_IDS } from "../seed";
import type { createMediaRepository } from "./media";

export interface AnkiMediaFile {
  name: string;
  bytes: Uint8Array;
}

export interface AnkiImportSummary {
  decks: number;
  noteTypes: number;
  notes: number;
  cards: number;
  skippedNotes: number;
  media: number;
}

export class AnkiImportError extends Error {
  constructor(readonly code: "invalid") {
    super(`anki import failed: ${code}`);
    this.name = "AnkiImportError";
  }
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
};
const mimeOf = (name: string) => MIME_BY_EXT[name.split(".").pop()?.toLowerCase() ?? ""] ?? "";

/** Imports an Anki collection read from a package (docs/08-import-export.md). */
export function createAnkiImportRepository({
  db,
  clock,
  ids,
  media,
}: {
  db: FixaDb;
  clock: Clock;
  ids: IdGenerator;
  media: ReturnType<typeof createMediaRepository>;
}) {
  return {
    async importCollection(
      raw: unknown,
      files: readonly AnkiMediaFile[],
    ): Promise<AnkiImportSummary> {
      let collection: AnkiCollection;
      try {
        collection = parseAnkiCollection(raw);
      } catch {
        throw new AnkiImportError("invalid");
      }

      const mediaNames = new Map<string, string>();
      for (const file of files) {
        const stored = await media.storeFile(
          new Blob([new Uint8Array(file.bytes)], { type: mimeOf(file.name) }),
          file.name,
        );
        mediaNames.set(file.name, stored.fileName);
      }

      const active = <T extends { deletedAt: number | null }>(rows: T[]) =>
        rows.filter((r) => r.deletedAt === null);
      const guids = collection.notes.map((n) => n.guid);
      const [existingDecks, existingPresets, existingNoteTypes, known] = await Promise.all([
        db.decks.toArray().then(active),
        db.presets.toArray().then(active),
        db.noteTypes.toArray().then(active),
        db.notes.where("guid").anyOf(guids).toArray().then(active),
      ]);

      const plan = planAnkiImport(collection, {
        now: clock.now(),
        ids,
        defaultPresetId: SEED_IDS.preset,
        existingDecks,
        existingPresets,
        existingNoteTypes,
        existingGuids: new Set(known.flatMap((n) => (n.guid ? [n.guid] : []))),
        mediaNames,
      });

      const notes = await Promise.all(
        plan.notes.map(async (n) => parseNote({ ...n, checksum: await sha256Hex(n.sortField) })),
      );
      const presets = plan.presets.map((p) => parsePreset(p));
      const decks = plan.decks.map((d) => parseDeck(d));
      const noteTypes = plan.noteTypes.map((nt) => parseNoteType(nt));
      const cards = plan.cards.map((c) => parseCard(c));
      const logs = plan.reviewLogs.map((l) => parseReviewLog(l));

      await db.transaction(
        "rw",
        [db.presets, db.decks, db.noteTypes, db.notes, db.cards, db.reviewLogs],
        async () => {
          await db.presets.bulkAdd(presets);
          await db.decks.bulkAdd(decks);
          await db.noteTypes.bulkAdd(noteTypes);
          await db.notes.bulkAdd(notes);
          await db.cards.bulkAdd(cards);
          await db.reviewLogs.bulkAdd(logs);
        },
      );

      return {
        decks: decks.length,
        noteTypes: noteTypes.length,
        notes: notes.length,
        cards: cards.length,
        skippedNotes: plan.skippedNotes,
        media: mediaNames.size,
      };
    },
  };
}
