import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { runtime } from "../../../data/runtime";
import { type FolderHandle, folderPermission } from "../../../lib/fsAccess";

/** The automatic-backup folder: choose (user gesture), back up now, turn off. */
export function useAutoBackup(pick: () => Promise<FolderHandle | null>, appVersion: string) {
  const stored = useLiveQuery(() => runtime().repos.autoBackup.folder(), []);
  // The handle just picked stays in memory; the stored copy is what survives reloads.
  const [picked, setPicked] = useState<FolderHandle | null>(null);
  const repo = () => runtime().repos.autoBackup;
  const folder = picked ?? stored ?? null;

  const write = async (handle: FolderHandle) => {
    await folderPermission(handle, true);
    return repo().writeTo(handle, appVersion);
  };

  return {
    folderName: folder?.name ?? null,
    async choose() {
      const handle = await pick();
      if (!handle) return null;
      await repo().setFolder(handle);
      setPicked(handle);
      return { name: handle.name, result: await write(handle) };
    },
    async runNow() {
      if (!folder) return null;
      return { name: folder.name, result: await write(folder) };
    },
    async turnOff() {
      setPicked(null);
      await repo().clearFolder();
    },
  };
}
