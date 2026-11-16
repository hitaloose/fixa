import { describe, expect, it } from "vitest";
import { sequentialIds, uuidv7Generator } from "./ids";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7Generator", () => {
  it("generates UUIDv7 strings", () => {
    expect(uuidv7Generator.next()).toMatch(UUID_V7);
  });

  it("generates unique, lexicographically increasing IDs", () => {
    const ids = Array.from({ length: 200 }, () => uuidv7Generator.next());
    expect(new Set(ids).size).toBe(200);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe("sequentialIds", () => {
  it("generates deterministic, valid UUIDv7 IDs starting at 1", () => {
    const ids = sequentialIds();
    expect(ids.next()).toBe("00000000-0000-7000-8000-000000000001");
    expect(ids.next()).toBe("00000000-0000-7000-8000-000000000002");
  });

  it("keeps lexicographic order past single digits", () => {
    const ids = sequentialIds();
    const all = Array.from({ length: 20 }, () => ids.next());
    expect(all.every((id) => UUID_V7.test(id))).toBe(true);
    expect([...all].sort()).toEqual(all);
  });

  it("restarts for each new generator", () => {
    sequentialIds().next();
    expect(sequentialIds().next()).toBe("00000000-0000-7000-8000-000000000001");
  });
});
