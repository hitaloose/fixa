import { z } from "zod";
import { epochMs } from "./base";

/** Device preferences. Not merged by backup (docs/04-modelo-de-dados.md › Tabelas auxiliares). */
export const settingsSchema = z.object({
  /** Hour (local) at which the study day rolls over. */
  cutoffHour: z.number().int().min(0).max(23),
  lastBackupAt: epochMs.nullable(),
  backupReminderDays: z.number().int().positive(),
  haptics: z.boolean(),
  /** "system" follows the device (prefers-color-scheme). */
  theme: z.enum(["system", "light", "dark"]),
  /** Interface language; applied on the next load (src/i18n/index.ts). */
  language: z.enum(["pt-BR", "en"]),
});

export type Settings = z.output<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  cutoffHour: 4,
  lastBackupAt: null,
  backupReminderDays: 7,
  haptics: true,
  theme: "system",
  language: "pt-BR",
};

/** Validates one setting value; throws when invalid. */
export function parseSetting<K extends SettingKey>(key: K, value: unknown): Settings[K] {
  return settingsSchema.shape[key].parse(value) as Settings[K];
}

/** Like parseSetting, but returns undefined for a missing or invalid value. */
export function safeParseSetting<K extends SettingKey>(
  key: K,
  value: unknown,
): Settings[K] | undefined {
  const result = settingsSchema.shape[key].safeParse(value);
  return result.success ? (result.data as Settings[K]) : undefined;
}
