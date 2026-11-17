import { beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { FACTORY_NOW, makeCard, makeNote } from "../../../tests/factories";
import type { Card, Note } from "../../domain/model";
import { fixedClock } from "../../lib/clock";
import type { FixaDb } from "../db";
import { createRepositories } from "./index";

const T = FACTORY_NOW + 60_000;
const DAY = 86_400_000;
const DECK = "00000000-0000-7000-8000-00000000d0d0";
let db: FixaDb;
let repos: ReturnType<typeof createRepositories>;
let note: Note;
let other: Note;
let fresh: Card;
let studied: Card;
let lone: Card;

beforeEach(async () => {
  db = testDb();
  let n = 0;
  const ids = { next: () => `00000000-0000-7000-9000-${(++n).toString(16).padStart(12, "0")}` };
  repos = createRepositories({ db, clock: fixedClock(T), ids });
  note = makeNote({ tags: ["verbos"] });
  other = makeNote({ tags: [] });
  fresh = makeCard({ noteId: note.id });
  studied = makeCard({
    noteId: note.id,
    templateOrd: 1,
    queue: "review",
    state: "review",
    reps: 3,
    stability: 4,
    difficulty: 5,
    scheduledDays: 4,
    lastReviewAt: FACTORY_NOW,
  });
  lone = makeCard({ noteId: other.id });
  await db.notes.bulkAdd([note, other]);
  await db.cards.bulkAdd([fresh, studied, lone]);
});

const card = (id: string) => db.cards.get(id);

describe("bulk", () => {
  it("moves cards to another deck", async () => {
    await repos.bulk.moveCards([fresh.id, lone.id], DECK);
    expect((await card(fresh.id))?.deckId).toBe(DECK);
    expect((await card(lone.id))?.deckId).toBe(DECK);
    expect((await card(studied.id))?.deckId).toBe(studied.deckId);
  });

  it("suspends and reactivates cards", async () => {
    await repos.bulk.setSuspended([studied.id], true);
    expect(await card(studied.id)).toMatchObject({
      queue: "suspended",
      state: "review",
      updatedAt: T,
    });
    await repos.bulk.setSuspended([studied.id], false);
    expect((await card(studied.id))?.queue).toBe("review");
  });

  it("flags cards", async () => {
    await repos.bulk.setFlag([fresh.id, studied.id], 4);
    expect((await card(fresh.id))?.flag).toBe(4);
    expect((await card(studied.id))?.flag).toBe(4);
  });

  it("reschedules studied cards, logging it, and skips new ones", async () => {
    const changed = await repos.bulk.reschedule([fresh.id, studied.id], 10);
    expect(changed).toBe(1);
    expect(await card(studied.id)).toMatchObject({ due: T + 10 * DAY, scheduledDays: 10 });
    expect(await card(fresh.id)).toEqual(fresh);
    expect((await db.reviewLogs.toArray()).map((l) => [l.cardId, l.kind, l.rating])).toEqual([
      [studied.id, "reschedule", 0],
    ]);
  });

  it("forgets cards, logging a reset", async () => {
    await repos.bulk.forget([studied.id]);
    expect(await card(studied.id)).toMatchObject({
      queue: "new",
      state: "new",
      reps: 0,
      newPosition: T,
    });
    expect((await db.reviewLogs.toArray()).map((l) => l.kind)).toEqual(["reset"]);
  });

  it("adds and removes tags on notes, normalised and without duplicates", async () => {
    await repos.bulk.addTags([note.id, other.id], ["Verbos", "novos"]);
    expect((await db.notes.get(note.id))?.tags).toEqual(["verbos", "novos"]);
    expect((await db.notes.get(other.id))?.tags).toEqual(["verbos", "novos"]);
    await repos.bulk.removeTags([note.id], ["verbos"]);
    expect(await db.notes.get(note.id)).toMatchObject({ tags: ["novos"], updatedAt: T });
  });

  it("deletes notes with all their cards", async () => {
    await repos.bulk.deleteNotes([note.id]);
    expect((await db.notes.get(note.id))?.deletedAt).toBe(T);
    expect((await card(fresh.id))?.deletedAt).toBe(T);
    expect((await card(studied.id))?.deletedAt).toBe(T);
    expect((await card(lone.id))?.deletedAt).toBeNull();
  });
});
