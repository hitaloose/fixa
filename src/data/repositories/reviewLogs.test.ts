import { describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { makeReviewLog } from "../../../tests/factories";
import { fixedClock } from "../../lib/clock";
import { createRepositories } from "./index";

describe("reviewLogs.bounds", () => {
  it("gives the first and last review times, or nulls without reviews", async () => {
    const db = testDb();
    const repos = createRepositories({ db, clock: fixedClock(0), ids: { next: () => "x" } });
    expect(await repos.reviewLogs.bounds()).toEqual({ first: null, last: null });
    await db.reviewLogs.bulkAdd([
      makeReviewLog({ reviewedAt: 3_000 }),
      makeReviewLog({ reviewedAt: 1_000 }),
      makeReviewLog({ reviewedAt: 2_000 }),
    ]);
    expect(await repos.reviewLogs.bounds()).toEqual({ first: 1_000, last: 3_000 });
  });
});
