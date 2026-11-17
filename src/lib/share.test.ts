// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { shareOrDownload } from "./share";

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
});

const file = () => new Blob(["x"], { type: "application/gzip" });

describe("shareOrDownload", () => {
  it("uses the share sheet when files can be shared", async () => {
    const share = vi.fn(async () => {});
    Object.assign(navigator, { share, canShare: () => true });
    expect(await shareOrDownload(file(), "fixa.fixa")).toBe("shared");
    const shared = (share.mock.calls[0] as unknown as [{ files: File[] }])[0];
    expect(shared.files[0]?.name).toBe("fixa.fixa");
  });

  it("treats a cancelled share as cancelled, not as an error", async () => {
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    Object.assign(navigator, {
      share: vi.fn(async () => Promise.reject(abort)),
      canShare: () => true,
    });
    expect(await shareOrDownload(file(), "fixa.fixa")).toBe("cancelled");
  });

  it("downloads the file otherwise", async () => {
    const createObjectURL = vi.fn(() => "blob:x");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe("fixa.fixa");
      expect(this.href).toBe("blob:x");
    });
    expect(await shareOrDownload(file(), "fixa.fixa")).toBe("downloaded");
    expect(click).toHaveBeenCalledOnce();
  });
});
