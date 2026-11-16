import { z } from "zod";
import { epochMs } from "./base";

/** Device preferences. Not merged by backup (docs/04-modelo-de-dados.md › Tabelas auxiliares). */
export const settingsSchema = z.object({
  /** Hour (local) at which the study day rolls over. */
  cutoffHour: z.number().int().min(0).max(23),
  lastBackupAt: epochMs.nullable(),
  backupReminderDays: z.number().int().positive(),
  haptics: z.boolean(),
  theme: z.enum(["light", "dark"]),
});

export type Settings = z.output<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  cutoffHour: 4,
  lastBackupAt: null,
  backupReminderDays: 7,
  haptics: true,
  theme: "light",
};
