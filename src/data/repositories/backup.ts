import {
  type Backup,
  type BackupData,
  type BackupMedia,
  buildBackup,
  mergeBackup,
  parseBackup,
} from "../../domain/backup";
import { parseMedia, type SettingKey, type Settings } from "../../domain/model";
import type { Clock } from "../../domain/ports";
import { base64ToBytes, bytesToBase64 } from "../../lib/base64";
import { gunzipText, gzipText } from "../../lib/gzip";
import type { FixaDb } from "../db";
import { BackupFileError } from "./errors";

const SOFT_DELETED = ["presets", "decks", "noteTypes", "notes", "cards"] as const;

/** Export, restore (replace or merge) and trash (docs/06-dados-e-backup.md). */
export function createBackupRepository({ db, clock }: { db: FixaDb; clock: Clock }) {
  const allTables = [
    db.presets,
    db.decks,
    db.noteTypes,
    db.notes,
    db.cards,
    db.reviewLogs,
    db.media,
    db.settings,
  ];

  /** Every record, deleted ones included (so deletions travel with the backup). */
  async function dumpData(): Promise<BackupData> {
    const [presets, decks, noteTypes, notes, cards, reviewLogs, settingRows] = await Promise.all([
      db.presets.toArray(),
      db.decks.toArray(),
      db.noteTypes.toArray(),
      db.notes.toArray(),
      db.cards.toArray(),
      db.reviewLogs.toArray(),
      db.settings.toArray(),
    ]);
    const settings = Object.fromEntries(
      settingRows.map((r) => [r.key, r.value]),
    ) as Partial<Settings>;
    return { presets, decks, noteTypes, notes, cards, reviewLogs, settings };
  }

  async function dumpMedia(): Promise<BackupMedia[]> {
    const media = await db.media.toArray();
    return Promise.all(
      media.map(async (m) => ({
        id: m.id,
        fileName: m.fileName,
        mime: m.mime,
        base64: bytesToBase64(new Uint8Array(await m.blob.arrayBuffer())),
      })),
    );
  }

  const toMedia = (m: BackupMedia) => {
    const bytes = base64ToBytes(m.base64);
    return parseMedia({
      id: m.id,
      fileName: m.fileName,
      mime: m.mime,
      size: bytes.length,
      blob: new Blob([bytes], { type: m.mime }),
    });
  };

  const fileDay = (now: number) => new Intl.DateTimeFormat("en-CA").format(now);

  return {
    /** A gzip file ready to share; records the moment in settings.lastBackupAt. */
    async exportFile({ light, appVersion }: { light: boolean; appVersion: string }) {
      const now = clock.now();
      const backup = buildBackup(await dumpData(), light ? [] : await dumpMedia(), {
        exportedAt: now,
        appVersion,
        light,
      });
      const bytes = gzipText(JSON.stringify(backup));
      await db.settings.put({ key: "lastBackupAt", value: now });
      return {
        blob: new Blob([bytes], { type: "application/gzip" }),
        fileName: `fixa-backup-${fileDay(now)}.fixa`,
      };
    },

    async readFile(file: Blob): Promise<Backup> {
      let json: unknown;
      try {
        json = JSON.parse(gunzipText(new Uint8Array(await file.arrayBuffer())));
      } catch {
        throw new BackupFileError("unreadable");
      }
      try {
        return parseBackup(json);
      } catch {
        throw new BackupFileError("invalid");
      }
    },

    /** Deletes everything local and loads the backup. */
    async replaceAll(backup: Backup): Promise<void> {
      const { data } = backup;
      const media = backup.media.map(toMedia);
      await db.transaction("rw", allTables, async () => {
        await Promise.all(allTables.map((table) => table.clear()));
        await db.presets.bulkAdd(data.presets);
        await db.decks.bulkAdd(data.decks);
        await db.noteTypes.bulkAdd(data.noteTypes);
        await db.notes.bulkAdd(data.notes);
        await db.cards.bulkAdd(data.cards);
        await db.reviewLogs.bulkAdd(data.reviewLogs);
        await db.media.bulkAdd(media);
        await db.settings.bulkAdd(
          (Object.keys(data.settings) as SettingKey[]).map((key) => ({
            key,
            value: data.settings[key],
          })),
        );
      });
    },

    /** Merges another device's backup (newer records win, reviews are combined and replayed). */
    async merge(backup: Backup): Promise<void> {
      const media = backup.media.map(toMedia);
      await db.transaction("rw", allTables, async () => {
        const merged = mergeBackup(await dumpData(), backup.data);
        await db.presets.bulkPut(merged.presets);
        await db.decks.bulkPut(merged.decks);
        await db.noteTypes.bulkPut(merged.noteTypes);
        await db.notes.bulkPut(merged.notes);
        await db.cards.bulkPut(merged.cards);
        await db.reviewLogs.bulkPut(merged.reviewLogs);
        const known = new Set(await db.media.toCollection().primaryKeys());
        await db.media.bulkAdd(media.filter((m) => !known.has(m.id)));
      });
    },

    async trashCount(): Promise<number> {
      const counts = await Promise.all(
        SOFT_DELETED.map((name) => db[name].filter((r) => r.deletedAt !== null).count()),
      );
      return counts.reduce((a, b) => a + b, 0);
    },

    /** Physically removes deleted records (and the review logs of removed cards). */
    emptyTrash: () => purge(() => true),

    /** Removes records deleted more than `ageMs` ago (run at startup with 30 days). */
    purgeTrash: (ageMs: number) => {
      const before = clock.now() - ageMs;
      return purge((deletedAt) => deletedAt < before);
    },
  };

  function purge(shouldPurge: (deletedAt: number) => boolean) {
    return db.transaction("rw", [...SOFT_DELETED.map((n) => db[n]), db.reviewLogs], async () => {
      const gone = (r: { deletedAt: number | null }) =>
        r.deletedAt !== null && shouldPurge(r.deletedAt);
      const cardIds = (await db.cards.filter(gone).toArray()).map((c) => c.id);
      if (cardIds.length > 0) await db.reviewLogs.where("cardId").anyOf(cardIds).delete();
      for (const name of SOFT_DELETED) await db[name].filter(gone).delete();
    });
  }
}
