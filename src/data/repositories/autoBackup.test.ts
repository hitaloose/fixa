import { describe, expect, it, vi } from "vitest";
import { testDb } from "../../../tests/db";
import { fixedClock } from "../../lib/clock";
import type { FolderHandle } from "../../lib/fsAccess";
import { gunzipText } from "../../lib/gzip";
import { createRepositories } from "./index";

const T = 1_800_000_000_000;
function setup() {
  const db = testDb();
  return { db, repos: createRepositories({ db, clock: fixedClock(T), ids: { next: () => "x" } }) };
}

function fakeFolder(permission: PermissionState = "granted") {
  const written: Record<string, Blob> = {};
  const folder: FolderHandle = {
    name: "Backups",
    queryPermission: async () => permission,
    getFileHandle: async (name: string) => ({
      createWritable: async () => {
        let data = new Blob();
        return {
          write: async (blob: Blob) => {
            data = blob;
          },
          close: async () => {
            written[name] = data;
          },
        };
      },
    }),
  };
  return { folder, written };
}

describe("autoBackup", () => {
  it("remembers the chosen folder until it is turned off", async () => {
    const { repos } = setup();
    expect(await repos.autoBackup.folder()).toBeNull();
    await repos.autoBackup.setFolder({ name: "Backups" } as unknown as FolderHandle);
    expect((await repos.autoBackup.folder())?.name).toBe("Backups");
    await repos.autoBackup.clearFolder();
    expect(await repos.autoBackup.folder()).toBeNull();
  });

  it("writes a full backup into the folder and records it as the last backup", async () => {
    const { repos } = setup();
    const { folder, written } = fakeFolder();
    expect(await repos.autoBackup.writeTo(folder, "0.1.0")).toBe("done");
    const file = written["fixa-backup-automatico.fixa"];
    if (!file) throw new Error("nothing written");
    expect(JSON.parse(gunzipText(new Uint8Array(await file.arrayBuffer())))).toMatchObject({
      format: "fixa-backup",
    });
    expect(await repos.settings.get("lastBackupAt")).toBe(T);
  });

  it("does nothing without write permission", async () => {
    const { repos } = setup();
    const { folder, written } = fakeFolder("prompt");
    expect(await repos.autoBackup.writeTo(folder, "0.1.0")).toBe("needs-permission");
    expect(written).toEqual({});
  });

  it("runs only when a folder is configured", async () => {
    const { repos } = setup();
    const spy = vi.spyOn(repos.autoBackup, "writeTo");
    expect(await repos.autoBackup.runIfConfigured("0.1.0")).toBe("off");
    expect(spy).not.toHaveBeenCalled();
  });
});
