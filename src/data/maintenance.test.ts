import { describe, expect, it } from "vitest";
import { testDb } from "../../tests/db";
import { FACTORY_NOW, makeCard } from "../../tests/factories";
import { fixedClock } from "../lib/clock";
import { runStartupMaintenance } from "./maintenance";
import { createRepositories } from "./repositories";

const DAY = 86_400_000;

describe("runStartupMaintenance", () => {
  it("purges what has been in the trash for more than 30 days", async () => {
    const db = testDb();
    const now = FACTORY_NOW + 100 * DAY;
    const repos = createRepositories({ db, clock: fixedClock(now), ids: { next: () => "x" } });
    const old = makeCard({ deletedAt: now - 31 * DAY, updatedAt: now - 31 * DAY });
    const recent = makeCard({ deletedAt: now - 29 * DAY, updatedAt: now - 29 * DAY });
    const active = makeCard();
    await db.cards.bulkAdd([old, recent, active]);
    await runStartupMaintenance(repos);
    expect((await db.cards.toArray()).map((c) => c.id).sort()).toEqual(
      [recent.id, active.id].sort(),
    );
  });
});
