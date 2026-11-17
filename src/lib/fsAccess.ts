/**
 * File System Access API for the automatic backup (docs/06 › Lembrete de backup): the user picks
 * a folder once and the app writes the backup there. Chrome/Edge only; elsewhere the reminder
 * stays the way to back up. Typed structurally so tests can pass a fake folder.
 */
interface Writable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

export interface FolderHandle {
  name: string;
  queryPermission?(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(options: { mode: "readwrite" }): Promise<PermissionState>;
  getFileHandle(
    name: string,
    options: { create: boolean },
  ): Promise<{ createWritable(): Promise<Writable> }>;
}

interface PickerHost {
  showDirectoryPicker?: (options: { id: string; mode: "readwrite" }) => Promise<FolderHandle>;
}

export const folderPickerSupported = (host: PickerHost): boolean =>
  typeof host.showDirectoryPicker === "function";

/** Asks the user for a folder; null when the picker is cancelled or unavailable. */
export async function pickFolder(host: PickerHost): Promise<FolderHandle | null> {
  if (!host.showDirectoryPicker) return null;
  try {
    return await host.showDirectoryPicker({ id: "fixa-backup", mode: "readwrite" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return null;
    throw error;
  }
}

/** Write permission for the folder; `request` may show a prompt (needs a user gesture). */
export async function folderPermission(
  folder: FolderHandle,
  request: boolean,
): Promise<PermissionState> {
  const options = { mode: "readwrite" } as const;
  const current = (await folder.queryPermission?.(options)) ?? "granted";
  if (current !== "prompt" || !request) return current;
  return (await folder.requestPermission?.(options)) ?? current;
}

export async function writeFileToFolder(
  folder: FolderHandle,
  fileName: string,
  data: Blob,
): Promise<void> {
  const file = await folder.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  await writable.write(data);
  await writable.close();
}
