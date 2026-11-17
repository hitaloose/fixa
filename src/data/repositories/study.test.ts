import { beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { FACTORY_NOW, makeCard, makeNote, makeReviewLog } from "../../../tests/factories";
import type { Card, Note } from "../../domain/model";
import { fixedClock } from "../../lib/clock";
import type { FixaDb } from "../db";
import { createRepositories } from "./index";

const T = FACTORY_NOW + 60_000;
let db: FixaDb;
let repos: ReturnType<typeof createRepositories>;
let note: Note;
let card: Card;
let sibling: Card;

beforeEach(async () => {
  db = testDb();
  repos = createRepositories({ db, clock: fixedClock(T), ids: { next: () => "unused" } });
  note = makeNote({ tags: ["verbos"] });
  card = makeCard({ noteId: note.id });
  sibling = makeCard({ noteId: note.id, templateOrd: 1 });
  await db.notes.add(note);
  await db.cards.bulkAdd([card, sibling]);
});

const answered = () => ({
  ...card,
  queue: "learning" as const,
  state: "learning" as const,
  reps: 1,
  updatedAt: T,
});
const buried = () => ({
  ...sibling,
  queue: "buried" as const,
  buriedUntilDay: "2026-11-17",
  updatedAt: T,
});
const log = () => makeReviewLog({ cardId: card.id, reviewedAt: T });

describe("cards.applyAnswer", () => {
  it("saves the card, its buried siblings and the log together", async () => {
    const entry = log();
    await repos.cards.applyAnswer({
      card: answered(),
      log: entry,
      buried: [buried()],
      tagLeech: false,
    });
    expect(await db.cards.get(card.id)).toEqual(answered());
    expect(await db.cards.get(sibling.id)).toEqual(buried());
    expect(await db.reviewLogs.get(entry.id)).toEqual(entry);
    expect((await db.notes.get(note.id))?.tags).toEqual(["verbos"]);
  });

  it("tags the note as a leech when asked", async () => {
    await repos.cards.applyAnswer({ card: answered(), log: log(), buried: [], tagLeech: true });
    expect(await db.notes.get(note.id)).toMatchObject({ tags: ["verbos", "leech"], updatedAt: T });
  });

  it("does not tag twice", async () => {
    await db.notes.update(note.id, { tags: ["leech"] });
    await repos.cards.applyAnswer({ card: answered(), log: log(), buried: [], tagLeech: true });
    expect((await db.notes.get(note.id))?.tags).toEqual(["leech"]);
  });

  it("writes nothing when the log is invalid", async () => {
    const bad = { ...log(), rating: 9 };
    await expect(
      repos.cards.applyAnswer({ card: answered(), log: bad, buried: [buried()], tagLeech: false }),
    ).rejects.toThrow();
    expect(await db.cards.get(card.id)).toEqual(card);
    expect(await db.reviewLogs.count()).toBe(0);
  });
});

describe("cards.undoAnswer", () => {
  it("restores the cards as they were, marks the log undone and removes an added leech tag", async () => {
    const entry = log();
    await repos.cards.applyAnswer({
      card: answered(),
      log: entry,
      buried: [buried()],
      tagLeech: true,
    });
    await repos.cards.undoAnswer({
      before: card,
      buriedBefore: [sibling],
      logId: entry.id,
      untagLeech: true,
    });
    expect(await db.cards.get(card.id)).toEqual({ ...card, updatedAt: T });
    expect(await db.cards.get(sibling.id)).toEqual({ ...sibling, updatedAt: T });
    expect((await db.reviewLogs.get(entry.id))?.undoneAt).toBe(T);
    expect((await db.notes.get(note.id))?.tags).toEqual(["verbos"]);
  });
});

describe("cards.save", () => {
  it("validates and stores a card, stamping updatedAt", async () => {
    await repos.cards.save({ ...card, flag: 2 });
    expect(await db.cards.get(card.id)).toEqual({ ...card, flag: 2, updatedAt: T });
    await expect(repos.cards.save({ ...card, flag: 9 })).rejects.toThrow();
  });
});

describe("cards.releaseBuried", () => {
  it("returns cards buried before today to their queue", async () => {
    await db.cards.bulkPut([
      { ...card, queue: "buried", buriedUntilDay: "2026-11-16" },
      { ...sibling, queue: "buried", buriedUntilDay: "2026-11-17" },
    ]);
    await repos.cards.releaseBuried("2026-11-16");
    expect(await db.cards.get(card.id)).toMatchObject({
      queue: "new",
      buriedUntilDay: null,
      updatedAt: T,
    });
    expect((await db.cards.get(sibling.id))?.queue).toBe("buried");
  });
});
