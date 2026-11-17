import { type FolderHandle, folderPermission, writeFileToFolder } from "../../lib/fsAccess";
import type { FixaDb } from "../db";
import type { createBackupRepository } from "./backup";

const FOLDER_KEY = "backupFolder";
export const AUTO_BACKUP_FILE = "fixa-backup-automatico.fixa";

export type AutoBackupResult = "done" | "needs-permission" | "off";

/** Automatic backup into a folder the user chose (File System Access API). */
export function createAutoBackupRepository({
  db,
  backup,
}: {
  db: FixaDb;
  backup: ReturnType<typeof createBackupRepository>;
}) {
  const repo = {
    async folder(): Promise<FolderHandle | null> {
      return ((await db.handles.get(FOLDER_KEY))?.handle as FolderHandle | undefined) ?? null;
    },

    setFolder: (handle: FolderHandle) => db.handles.put({ key: FOLDER_KEY, handle }),

    clearFolder: () => db.handles.delete(FOLDER_KEY),

    /** Writes a full backup (one rolling file) when the folder can be written without asking. */
    async writeTo(folder: FolderHandle, appVersion: string): Promise<AutoBackupResult> {
      if ((await folderPermission(folder, false)) !== "granted") return "needs-permission";
      const { blob } = await backup.exportFile({ light: false, appVersion });
      await writeFileToFolder(folder, AUTO_BACKUP_FILE, blob);
      return "done";
    },

    async runIfConfigured(appVersion: string): Promise<AutoBackupResult> {
      const folder = await repo.folder();
      return folder ? repo.writeTo(folder, appVersion) : "off";
    },
  };
  return repo;
}
