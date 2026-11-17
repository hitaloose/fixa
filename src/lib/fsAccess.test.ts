// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  type FolderHandle,
  folderPermission,
  folderPickerSupported,
  pickFolder,
  writeFileToFolder,
} from "./fsAccess";

function fakeFolder(permission: PermissionState = "granted") {
  const written: Record<string, string> = {};
  const folder: FolderHandle = {
    name: "Backups",
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => "granted" as PermissionState),
    getFileHandle: vi.fn(async (name: string) => ({
      createWritable: async () => {
        let content = "";
        return {
          write: async (data: Blob) => {
            content = await data.text();
          },
          close: async () => {
            written[name] = content;
          },
        };
      },
    })),
  };
  return { folder, written };
}

describe("fsAccess", () => {
  it("knows whether the folder picker exists", () => {
    expect(folderPickerSupported({})).toBe(false);
    expect(folderPickerSupported({ showDirectoryPicker: async () => fakeFolder().folder })).toBe(
      true,
    );
  });

  it("picks a folder for reading and writing, or returns null when cancelled", async () => {
    const { folder } = fakeFolder();
    const showDirectoryPicker = vi.fn(async () => folder);
    expect(await pickFolder({ showDirectoryPicker })).toBe(folder);
    expect(showDirectoryPicker).toHaveBeenCalledWith({ id: "fixa-backup", mode: "readwrite" });
    const cancel = async () =>
      Promise.reject(Object.assign(new Error("x"), { name: "AbortError" }));
    expect(await pickFolder({ showDirectoryPicker: cancel })).toBeNull();
  });

  it("checks permission, asking only when allowed to", async () => {
    const { folder } = fakeFolder("prompt");
    expect(await folderPermission(folder, false)).toBe("prompt");
    expect(folder.requestPermission).not.toHaveBeenCalled();
    expect(await folderPermission(folder, true)).toBe("granted");
  });

  it("writes a file into the folder, replacing it", async () => {
    const { folder, written } = fakeFolder();
    await writeFileToFolder(folder, "fixa.fixa", new Blob(["v1"]));
    await writeFileToFolder(folder, "fixa.fixa", new Blob(["v2"]));
    expect(written).toEqual({ "fixa.fixa": "v2" });
    expect(folder.getFileHandle).toHaveBeenCalledWith("fixa.fixa", { create: true });
  });
});
