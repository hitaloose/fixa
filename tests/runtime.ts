import { configureRuntime, runtime } from "../src/data/runtime";
import { fixedClock } from "../src/lib/clock";
import { testDb } from "./db";

/** Runtime for component tests: real in-memory DB, fixed clock, fixed zone. */
export function setupRuntime({
  now = Date.parse("2026-11-16T15:00:00Z"),
  timeZone = "America/Sao_Paulo",
} = {}) {
  const db = testDb();
  const clock = fixedClock(now);
  let n = 0;
  // IDs in their own range so they never collide with factory IDs.
  const ids = { next: () => `00000000-0000-7000-9000-${(++n).toString(16).padStart(12, "0")}` };
  configureRuntime({ db, clock, ids, timeZone });
  return { ...runtime(), clock };
}
