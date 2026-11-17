/**
 * Backup file format v1 (docs/06-dados-e-backup.md › Formato). Entities are validated with
 * the model's own parse functions; deleted records are included so deletions survive a merge.
 */
import { z } from "zod";
import {
  type Card,
  type Deck,
  type Note,
  type NoteType,
  type Preset,
  parseCard,
  parseDeck,
  parseNote,
  parseNoteType,
  parsePreset,
  parseReviewLog,
  parseSetting,
  type ReviewLog,
  type SettingKey,
  type Settings,
} from "../model";

export const BACKUP_FORMAT = "fixa-backup";
export const BACKUP_VERSION = 1;

export interface BackupData {
  presets: Preset[];
  decks: Deck[];
  noteTypes: NoteType[];
  notes: Note[];
  cards: Card[];
  reviewLogs: ReviewLog[];
  settings: Partial<Settings>;
}

export interface BackupMedia {
  /** SHA-256 of the content. */
  id: string;
  fileName: string;
  mime: string;
  base64: string;
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  appVersion: string;
  data: BackupData;
  media: BackupMedia[];
}

/** A zod step that delegates to a model parse function (keeps model schemas private). */
const via = <T>(parse: (value: unknown) => T) =>
  z.unknown().transform((value, ctx): T => {
    try {
      return parse(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : String(error),
      });
      return z.NEVER;
    }
  });

const SETTING_KEYS: readonly SettingKey[] = [
  "cutoffHour",
  "lastBackupAt",
  "backupReminderDays",
  "haptics",
  "theme",
];

const settingsSchema = z.record(z.string(), z.unknown()).transform((raw, ctx) => {
  const settings: Partial<Settings> = {};
  for (const key of SETTING_KEYS) {
    if (!(key in raw)) continue;
    try {
      Object.assign(settings, { [key]: parseSetting(key, raw[key]) });
    } catch {
      ctx.addIssue({ code: "custom", message: `invalid setting ${key}`, path: [key] });
    }
  }
  return settings;
});

const backupV1 = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number().int().nonnegative(),
  appVersion: z.string(),
  data: z.object({
    presets: z.array(via(parsePreset)),
    decks: z.array(via(parseDeck)),
    noteTypes: z.array(via(parseNoteType)),
    notes: z.array(via(parseNote)),
    cards: z.array(via(parseCard)),
    reviewLogs: z.array(via(parseReviewLog)),
    settings: settingsSchema,
  }),
  media: z.array(
    z.object({
      id: z.string().regex(/^[0-9a-f]{64}$/),
      fileName: z.string().min(1),
      mime: z.string().min(1),
      base64: z.string(),
    }),
  ),
});

export interface BackupMeta {
  exportedAt: number;
  appVersion: string;
  /** Without media and review history (smaller file). */
  light: boolean;
}

export function buildBackup(data: BackupData, media: BackupMedia[], meta: BackupMeta): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: meta.exportedAt,
    appVersion: meta.appVersion,
    data: meta.light ? { ...data, reviewLogs: [] } : data,
    media: meta.light ? [] : media,
  };
}

/** Validates a parsed backup file; throws a readable error when it cannot be used. */
export function parseBackup(input: unknown): Backup {
  const head = z
    .object({ format: z.literal(BACKUP_FORMAT), version: z.unknown() })
    .safeParse(input);
  if (!head.success) throw new Error("not a Fixa backup");
  if (head.data.version !== BACKUP_VERSION) {
    throw new Error(`unsupported backup version ${String(head.data.version)}`);
  }
  const result = backupV1.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`invalid backup at ${issue?.path.join(".") ?? "?"}: ${issue?.message ?? ""}`);
  }
  return result.data as Backup;
}
