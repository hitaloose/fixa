import { describe, expect, it } from "vitest";
import { testDb } from "../../tests/db";
import { fixedClock } from "../lib/clock";
import { sequentialIds } from "../lib/ids";
import { configureRuntime, resetRuntime, runtime } from "./runtime";

describe("data runtime", () => {
  it("throws a clear error when used before the app configured it", () => {
    resetRuntime();
    expect(() => runtime()).toThrow(/configureRuntime/);
  });

  it("exposes the configured clock, ids and repositories bound to the db", async () => {
    const db = testDb();
    const clock = fixedClock(42);
    configureRuntime({ db, clock, ids: sequentialIds(), timeZone: "America/Sao_Paulo" });
    const rt = runtime();
    expect(rt.clock.now()).toBe(42);
    expect(rt.timeZone).toBe("America/Sao_Paulo");
    const preset = await rt.repos.presets.create({});
    expect(await db.presets.get(preset.id)).toEqual(preset);
  });

  it("replaces the previous configuration", () => {
    configureRuntime({ db: testDb(), clock: fixedClock(1), ids: sequentialIds(), timeZone: "UTC" });
    configureRuntime({ db: testDb(), clock: fixedClock(2), ids: sequentialIds(), timeZone: "UTC" });
    expect(runtime().clock.now()).toBe(2);
  });
});
