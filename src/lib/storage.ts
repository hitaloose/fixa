export type PersistStatus = "persisted" | "denied" | "unsupported";

interface StorageLike {
  persisted(): Promise<boolean>;
  persist(): Promise<boolean>;
}

/**
 * Asks the browser not to evict IndexedDB under storage pressure (docs/06-dados-e-backup.md).
 * Pass `navigator` in production.
 */
export async function requestPersistentStorage(nav: {
  storage?: StorageLike;
}): Promise<PersistStatus> {
  const storage = nav.storage;
  if (!storage?.persist || !storage.persisted) return "unsupported";
  try {
    if (await storage.persisted()) return "persisted";
    return (await storage.persist()) ? "persisted" : "denied";
  } catch {
    return "unsupported";
  }
}

export interface StorageInfo {
  persisted: boolean;
  usage: number;
  quota: number;
}

/** What the settings screen shows about local storage; null where the API is missing. */
export async function storageInfo(nav: {
  storage?: StorageLike & { estimate?: () => Promise<{ usage?: number; quota?: number }> };
}): Promise<StorageInfo | null> {
  const storage = nav.storage;
  if (!storage?.estimate || !storage.persisted) return null;
  const [persisted, estimate] = await Promise.all([storage.persisted(), storage.estimate()]);
  return { persisted, usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
