import { describe, expect, it } from "vitest";
import { ankiChecksum, sha256Hex } from "./hash";

const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("sha256Hex", () => {
  it("hashes text as UTF-8 (oracle: shasum -a 256)", async () => {
    expect(await sha256Hex("abc")).toBe(ABC);
    expect(await sha256Hex("ã")).toBe(
      "59c63e6cac333a7b990ad1c2a342978cdb72e3e5e702e6620501a29e593e0d84",
    );
  });

  it("hashes blobs by content", async () => {
    expect(await sha256Hex(new Blob(["abc"]))).toBe(ABC);
  });
});

describe("ankiChecksum", () => {
  it("is the first 8 hex digits of the SHA-1 of the text, as a number (Anki's notes.csum)", async () => {
    // sha1("cat") = 9d989e8d27dc9e0ec3389fc855f142c3d40f0c50
    expect(await ankiChecksum("cat")).toBe(0x9d989e8d);
  });
});
