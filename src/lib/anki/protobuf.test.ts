import { describe, expect, it } from "vitest";
import {
  decodeProto,
  protoBool,
  protoFloat,
  protoFloats,
  protoMessage,
  protoNumber,
  protoString,
} from "./protobuf";

describe("decodeProto", () => {
  it("reads varints (including negative int64), strings, nested messages and floats", () => {
    // 1: 300, 2: -1 (int64), 3: "hi", 4: { 1: 1 }, 5: 0.5f, 6: packed [1, 10]
    const bytes = Uint8Array.from([
      0x08, 0xac, 0x02, 0x10, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01, 0x1a,
      0x02, 0x68, 0x69, 0x22, 0x02, 0x08, 0x01, 0x2d, 0x00, 0x00, 0x00, 0x3f, 0x32, 0x08, 0x00,
      0x00, 0x80, 0x3f, 0x00, 0x00, 0x20, 0x41,
    ]);
    const fields = decodeProto(bytes);
    expect(protoNumber(fields, 1)).toBe(300);
    expect(protoNumber(fields, 2)).toBe(-1);
    expect(protoString(fields, 3)).toBe("hi");
    expect(protoBool(protoMessage(fields, 4) ?? new Map(), 1)).toBe(true);
    expect(protoFloat(fields, 5)).toBe(0.5);
    expect(protoFloats(fields, 6)).toEqual([1, 10]);
  });

  it("gives proto3 defaults for absent fields", () => {
    const empty = decodeProto(new Uint8Array());
    expect([protoNumber(empty, 1), protoBool(empty, 1), protoString(empty, 1)]).toEqual([
      0,
      false,
      "",
    ]);
    expect(protoMessage(empty, 1)).toBeNull();
    expect(protoFloat(empty, 1)).toBeUndefined();
  });

  it("throws on truncated input", () => {
    expect(() => decodeProto(Uint8Array.from([0x08, 0x80]))).toThrow("truncated varint");
    expect(() => decodeProto(Uint8Array.from([0x1a, 0x05, 0x68]))).toThrow("truncated field");
  });
});
