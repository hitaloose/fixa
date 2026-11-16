import type { EntityTable } from "dexie";
import {
  DEFAULT_SETTINGS,
  type SettingKey,
  type Settings,
  settingsSchema,
} from "../../domain/model";
import type { SettingRow } from "../db";

export function createSettingsRepository({ table }: { table: EntityTable<SettingRow, "key"> }) {
  return {
    async get<K extends SettingKey>(key: K): Promise<Settings[K]> {
      const row = await table.get(key);
      const parsed = settingsSchema.shape[key].safeParse(row?.value);
      return parsed.success ? (parsed.data as Settings[K]) : DEFAULT_SETTINGS[key];
    },

    async set<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
      await table.put({ key, value: settingsSchema.shape[key].parse(value) });
    },
  };
}
