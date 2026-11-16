import { describe, expect, it, vi } from "vitest";
import { fixedClock, systemClock } from "./clock";

describe("systemClock", () => {
  it("returns the real current time", () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    try {
      expect(systemClock.now()).toBe(1_700_000_000_000);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("fixedClock", () => {
  it("always returns the instant it was created with", () => {
    const clock = fixedClock(1_000);
    expect(clock.now()).toBe(1_000);
    expect(clock.now()).toBe(1_000);
  });

  it("advances by the given milliseconds", () => {
    const clock = fixedClock(1_000);
    clock.advance(250);
    expect(clock.now()).toBe(1_250);
  });

  it("can be set to an absolute instant", () => {
    const clock = fixedClock(1_000);
    clock.set(5_000);
    expect(clock.now()).toBe(5_000);
  });
});
