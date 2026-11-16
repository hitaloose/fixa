import { describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { makeCard, makeReviewLog } from "../../../tests/factories";
import { fixedClock } from "../../lib/clock";
import { sequentialIds } from "../../lib/ids";
import { createRepositories } from "./index";

const T = 9_000_000;

function setup() {
  const db = testDb();
  return { db, repos: createRepositories({ db, clock: fixedClock(T), ids: sequentialIds() }) };
}

const sorted = (ids: string[]) => [...ids].sort();

describe("cards.studyCandidates", () => {
  it("returns new and buried cards plus scheduled cards due before the end of day", async () => {
    const { db, repos } = setup();
    const end = T + 1_000;
    const wanted = [
      makeCard(),
      makeCard({ queue: "buried", state: "review", buriedUntilDay: "2026-11-17", due: end + 50 }),
      makeCard({ queue: "review", state: "review", due: end - 1, reps: 1 }),
      makeCard({ queue: "learning", state: "learning", due: end - 1, reps: 1 }),
      makeCard({ queue: "relearning", state: "relearning", due: end - 1, reps: 2 }),
    ];
    const unwanted = [
      makeCard({ queue: "review", state: "review", due: end, reps: 1 }),
      makeCard({ queue: "suspended", state: "review", due: 0, reps: 1 }),
      makeCard({ deletedAt: T }),
    ];
    await db.cards.bulkAdd([...wanted, ...unwanted]);
    expect(sorted((await repos.cards.studyCandidates(end)).map((c) => c.id))).toEqual(
      sorted(wanted.map((c) => c.id)),
    );
  });
});

describe("cards.inDecks", () => {
  it("returns active cards of the given decks", async () => {
    const { db, repos } = setup();
    const a = makeCard();
    const b = makeCard();
    const deleted = makeCard({ deckId: a.deckId, deletedAt: T });
    await db.cards.bulkAdd([a, b, deleted, makeCard()]);
    expect(sorted((await repos.cards.inDecks([a.deckId, b.deckId])).map((c) => c.id))).toEqual(
      sorted([a.id, b.id]),
    );
  });
});

describe("reviewLogs.since / recent", () => {
  it("since returns logs reviewed at or after an instant", async () => {
    const { repos } = setup();
    const before = makeReviewLog({ reviewedAt: T - 1 });
    const at = makeReviewLog({ reviewedAt: T });
    const after = makeReviewLog({ reviewedAt: T + 5 });
    for (const l of [before, at, after]) await repos.reviewLogs.append(l);
    expect(sorted((await repos.reviewLogs.since(T)).map((l) => l.id))).toEqual(
      sorted([at.id, after.id]),
    );
  });

  it("recent returns the latest logs, newest first, up to a limit", async () => {
    const { repos } = setup();
    const logs = [1, 3, 2].map((n) => makeReviewLog({ reviewedAt: T + n }));
    for (const l of logs) await repos.reviewLogs.append(l);
    expect((await repos.reviewLogs.recent(2)).map((l) => l.reviewedAt)).toEqual([T + 3, T + 2]);
  });
});
