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
