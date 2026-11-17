import { describe, expect, it } from "vitest";
import { gunzipText, gzipText } from "./gzip";

describe("gzip", () => {
  it("round-trips text, accents included, and actually compresses", () => {
    const text = JSON.stringify({ nome: "Inglês ção", items: Array(200).fill("repetição") });
    const packed = gzipText(text);
    expect(packed[0]).toBe(0x1f); // gzip magic
    expect(packed[1]).toBe(0x8b);
    expect(packed.length).toBeLessThan(text.length / 5);
    expect(gunzipText(packed)).toBe(text);
  });

  it("rejects data that is not gzip", () => {
    expect(() => gunzipText(new TextEncoder().encode("plain"))).toThrow();
  });
});
