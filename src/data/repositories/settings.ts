import type { EntityTable } from "dexie";
import {
  DEFAULT_SETTINGS,
  parseSetting,
  type SettingKey,
  type Settings,
  safeParseSetting,
} from "../../domain/model";
import type { SettingRow } from "../db";

export function createSettingsRepository({ table }: { table: EntityTable<SettingRow, "key"> }) {
  return {
    async get<K extends SettingKey>(key: K): Promise<Settings[K]> {
      const row = await table.get(key);
      const stored = row ? safeParseSetting(key, row.value) : undefined;
      return stored === undefined ? DEFAULT_SETTINGS[key] : stored;
    },

    async set<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
      await table.put({ key, value: parseSetting(key, value) });
    },
  };
}
