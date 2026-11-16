import { describe, expect, it } from "vitest";
import { deviceTimeZone } from "./timeZone";

describe("deviceTimeZone", () => {
  it("returns the IANA zone the runtime reports", () => {
    expect(deviceTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
