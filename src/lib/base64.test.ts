import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToBase64 } from "./base64";

describe("base64", () => {
  it("encodes bytes like the platform does", () => {
    expect(bytesToBase64(new TextEncoder().encode("png"))).toBe("cG5n");
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
  });

  it("round-trips arbitrary bytes, including large ones", () => {
    const bytes = Uint8Array.from({ length: 200_000 }, (_, i) => (i * 31) % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});
