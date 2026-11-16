import { afterEach } from "vitest";
import { createDb, type FixaDb } from "../src/data/db";

let n = 0;
const open: FixaDb[] = [];

afterEach(async () => {
  await Promise.all(open.splice(0).map((db) => db.delete()));
});

/** A fresh, isolated IndexedDB (fake-indexeddb) deleted after the test. */
export function testDb(): FixaDb {
  n += 1;
  const db = createDb(`fixa-test-${n}`);
  open.push(db);
  return db;
}
