import { describe, expect, it, vi } from "vitest";
import { requestPersistentStorage, storageInfo } from "./storage";

describe("requestPersistentStorage", () => {
  it("reports 'unsupported' when the Storage API is missing", async () => {
    expect(await requestPersistentStorage({})).toBe("unsupported");
  });

  it("does not ask again when storage is already persisted", async () => {
    const persist = vi.fn();
    const storage = { persisted: async () => true, persist };
    expect(await requestPersistentStorage({ storage })).toBe("persisted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("asks for persistence and reports 'persisted' when granted", async () => {
    const storage = { persisted: async () => false, persist: async () => true };
    expect(await requestPersistentStorage({ storage })).toBe("persisted");
  });

  it("reports 'denied' when the browser refuses", async () => {
    const storage = { persisted: async () => false, persist: async () => false };
    expect(await requestPersistentStorage({ storage })).toBe("denied");
  });

  it("reports 'unsupported' instead of throwing when the API fails", async () => {
    const storage = {
      persisted: async () => {
        throw new Error("SecurityError");
      },
      persist: async () => true,
    };
    expect(await requestPersistentStorage({ storage })).toBe("unsupported");
  });
});

describe("storageInfo", () => {
  it("reports persistence and usage", async () => {
    const nav = {
      storage: {
        persisted: async () => true,
        persist: async () => true,
        estimate: async () => ({ usage: 2_000_000, quota: 100_000_000 }),
      },
    };
    expect(await storageInfo(nav)).toEqual({
      persisted: true,
      usage: 2_000_000,
      quota: 100_000_000,
    });
  });

  it("is null where the Storage API does not exist", async () => {
    expect(await storageInfo({})).toBeNull();
  });
});
