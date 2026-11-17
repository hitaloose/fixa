import type { Repositories } from "./repositories";

/** Deleted records stay restorable this long, then are removed for good (docs/06 › Exclusão). */
export const TRASH_RETENTION_MS = 30 * 86_400_000;

/** Housekeeping run once when the app starts. */
export async function runStartupMaintenance(repos: Repositories): Promise<void> {
  await repos.backup.purgeTrash(TRASH_RETENTION_MS);
}
