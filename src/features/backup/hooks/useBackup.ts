import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { runtime } from "../../../data/runtime";
import { backupReminder } from "../../../domain/backup";
import type { SettingKey, Settings } from "../../../domain/model";
import { requestPersistentStorage, type StorageInfo, storageInfo } from "../../../lib/storage";

const DAY_MS = 86_400_000;

export interface SettingsData {
  daysSinceBackup: number | null;
  cutoffHour: number;
  haptics: boolean;
  backupReminderDays: number;
  trashCount: number;
  theme: Settings["theme"];
  language: Settings["language"];
}

export function useSettingsData(): SettingsData | undefined {
  return useLiveQuery(async () => {
    const { repos, clock } = runtime();
    const [lastBackupAt, cutoffHour, haptics, backupReminderDays, trashCount, theme, language] =
      await Promise.all([
        repos.settings.get("lastBackupAt"),
        repos.settings.get("cutoffHour"),
        repos.settings.get("haptics"),
        repos.settings.get("backupReminderDays"),
        repos.backup.trashCount(),
        repos.settings.get("theme"),
        repos.settings.get("language"),
      ]);
    return {
      daysSinceBackup:
        lastBackupAt === null ? null : Math.floor((clock.now() - lastBackupAt) / DAY_MS),
      cutoffHour,
      haptics,
      backupReminderDays,
      trashCount,
      theme,
      language,
    };
  }, []);
}

/** The home-screen reminder, or null when no reminder is due. */
export function useBackupReminder() {
  return useLiveQuery(async () => {
    const { repos, clock } = runtime();
    const [lastBackupAt, reminderDays, bounds] = await Promise.all([
      repos.settings.get("lastBackupAt"),
      repos.settings.get("backupReminderDays"),
      repos.reviewLogs.bounds(),
    ]);
    return backupReminder({
      now: clock.now(),
      lastBackupAt,
      firstReviewAt: bounds.first,
      lastReviewAt: bounds.last,
      reminderDays,
    });
  }, []);
}

export function useStorageInfo() {
  const [info, setInfo] = useState<StorageInfo | null | undefined>(undefined);
  const refresh = () => void storageInfo(navigator).then(setInfo);
  useEffect(refresh, []);
  return {
    info,
    askPersist: async () => {
      await requestPersistentStorage(navigator);
      refresh();
    },
  };
}

export function useBackupActions() {
  const repos = () => runtime().repos;
  return {
    exportFile: (light: boolean, appVersion: string) =>
      repos().backup.exportFile({ light, appVersion }),
    readFile: (file: Blob) => repos().backup.readFile(file),
    merge: (backup: Parameters<ReturnType<typeof runtime>["repos"]["backup"]["merge"]>[0]) =>
      repos().backup.merge(backup),
    replaceAll: (
      backup: Parameters<ReturnType<typeof runtime>["repos"]["backup"]["replaceAll"]>[0],
    ) => repos().backup.replaceAll(backup),
    emptyTrash: () => repos().backup.emptyTrash(),
    setSetting: <K extends SettingKey>(key: K, value: Settings[K]) =>
      repos().settings.set(key, value),
  };
}
