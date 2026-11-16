import type { Clock, IdGenerator } from "../domain/ports";
import type { FixaDb } from "./db";
import { createRepositories, type Repositories } from "./repositories";

export interface Runtime {
  db: FixaDb;
  clock: Clock;
  ids: IdGenerator;
  repos: Repositories;
}

let current: Runtime | null = null;

/**
 * Wires the db, clock and ID generator once at bootstrap (src/app) and per test.
 * Features reach data through `runtime().repos` from their own hooks — never by importing app.
 */
export function configureRuntime(deps: { db: FixaDb; clock: Clock; ids: IdGenerator }): void {
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
