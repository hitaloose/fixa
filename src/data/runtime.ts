import type { Clock, IdGenerator } from "../domain/ports";
import type { FixaDb } from "./db";
import { createRepositories, type Repositories } from "./repositories";

export interface RuntimeDeps {
  db: FixaDb;
  clock: Clock;
  ids: IdGenerator;
  /** IANA zone used for the study day (the device's, injected so tests are deterministic). */
  timeZone: string;
}

export interface Runtime extends RuntimeDeps {
  repos: Repositories;
}

let current: Runtime | null = null;

/**
 * Wires the db, clock, ID generator and time zone once at bootstrap (src/app) and per test.
 * Features reach data through `runtime().repos` from their own hooks — never by importing app.
 */
export function configureRuntime(deps: RuntimeDeps): void {
  current = { ...deps, repos: createRepositories(deps) };
}

export function resetRuntime(): void {
  current = null;
}

export function runtime(): Runtime {
  if (!current)
    throw new Error("data runtime not configured: call configureRuntime() at bootstrap");
  return current;
}
