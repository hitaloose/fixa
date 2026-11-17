import { beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import {
  FACTORY_NOW,
  makeCard,
  makeDeck,
  makeMedia,
  makeNote,
  makeNoteType,
  makePreset,
  makeReviewLog,
} from "../../../tests/factories";
import { fixedClock } from "../../lib/clock";
import type { FixaDb } from "../db";
import { BackupFileError, createRepositories } from "./index";

const T = FACTORY_NOW + 1_000_000;
const DAY = 86_400_000;

function device() {
  const db = testDb();
  const clock = fixedClock(T);
  let n = 0;
  const ids = { next: () => `00000000-0000-7000-9000-${(++n).toString(16).padStart(12, "0")}` };
  return { db, clock, repos: createRepositories({ db, clock, ids }) };
}

async function seed(db: FixaDb) {
  const preset = makePreset();
  const deck = makeDeck({ presetId: preset.id });
  const noteType = makeNoteType();
  const note = makeNote({ noteTypeId: noteType.id });
  const card = makeCard({ noteId: note.id, deckId: deck.id });
  const log = makeReviewLog({ cardId: card.id });
  const media = makeMedia();
  await db.presets.add(preset);
  await db.decks.add(deck);
  await db.noteTypes.add(noteType);
  await db.notes.add(note);
  await db.cards.add(card);
  await db.reviewLogs.add(log);
  await db.media.add(media);
  await db.settings.put({ key: "cutoffHour", value: 6 });
  return { preset, deck, noteType, note, card, log, media };
}

const tables = async (db: FixaDb) => ({
  presets: await db.presets.toArray(),
  decks: await db.decks.toArray(),
  noteTypes: await db.noteTypes.toArray(),
  notes: await db.notes.toArray(),
  cards: await db.cards.toArray(),
  reviewLogs: await db.reviewLogs.toArray(),
});

let a: ReturnType<typeof device>;
let b: ReturnType<typeof device>;
beforeEach(() => {
  a = device();
  b = device();
});

describe("backup export / restore", () => {
  it("exports a gzip file named by date and records when", async () => {
    await seed(a.db);
    const { blob, fileName } = await a.repos.backup.exportFile({
      light: false,
      appVersion: "0.1.0",
    });
    expect(fileName).toMatch(/^fixa-backup-\d{4}-\d{2}-\d{2}\.fixa$/);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
    expect(await a.repos.settings.get("lastBackupAt")).toBe(T);
  });

  it("replaces everything with the backup's content", async () => {
    const original = await seed(a.db);
    await seed(b.db);
    const { blob } = await a.repos.backup.exportFile({ light: false, appVersion: "0.1.0" });
    await b.repos.backup.replaceAll(await b.repos.backup.readFile(blob));
    expect(await tables(b.db)).toEqual(await tables(a.db));
    const media = await b.db.media.get(original.media.id);
    expect(media?.fileName).toBe(original.media.fileName);
    if (!media) throw new Error("media was not restored");
    expect(new Uint8Array(await media.blob.arrayBuffer())).toEqual(
      new Uint8Array(await original.media.blob.arrayBuffer()),
    );
    expect(await b.repos.settings.get("cutoffHour")).toBe(6);
  });

  it("leaves history and media out of a light backup", async () => {
    await seed(a.db);
    const { blob } = await a.repos.backup.exportFile({ light: true, appVersion: "0.1.0" });
    const backup = await b.repos.backup.readFile(blob);
    expect(backup.data.reviewLogs).toEqual([]);
    expect(backup.media).toEqual([]);
    expect(backup.data.cards).toHaveLength(1);
  });

  it("refuses files that are not valid backups", async () => {
    await expect(b.repos.backup.readFile(new Blob(["nope"]))).rejects.toEqual(
      new BackupFileError("unreadable"),
    );
    const notOurs = new Blob([
      new Uint8Array((await import("../../lib/gzip")).gzipText('{"format":"x"}')),
    ]);
    await expect(b.repos.backup.readFile(notOurs)).rejects.toEqual(new BackupFileError("invalid"));
  });
});

describe("backup merge", () => {
  it("merges another device's backup, keeping newer records and every review", async () => {
    const shared = await seed(a.db);
    await b.repos.backup.replaceAll(
      await b.repos.backup.readFile(
        (await a.repos.backup.exportFile({ light: false, appVersion: "x" })).blob,
      ),
    );
    // Device B renames the deck later and adds a review; device A deletes nothing.
    await b.db.decks.update(shared.deck.id, { name: "Renomeado", updatedAt: T + DAY });
    const extraLog = makeReviewLog({
      cardId: shared.card.id,
      reviewedAt: FACTORY_NOW + DAY,
      rating: 4,
    });
    await b.db.reviewLogs.add(extraLog);
    const fromB = await a.repos.backup.readFile(
      (await b.repos.backup.exportFile({ light: false, appVersion: "x" })).blob,
    );
    await a.repos.backup.merge(fromB);
    expect((await a.db.decks.get(shared.deck.id))?.name).toBe("Renomeado");
    expect((await a.db.reviewLogs.toArray()).map((l) => l.id).sort()).toEqual(
      [shared.log.id, extraLog.id].sort(),
    );
    expect((await a.db.cards.get(shared.card.id))?.reps).toBe(2);
    expect(await a.db.media.count()).toBe(1);
  });
});

describe("trash", () => {
  it("counts and empties deleted records, with the logs of deleted cards", async () => {
    const { card, note } = await seed(a.db);
    await a.db.cards.update(card.id, { deletedAt: T, updatedAt: T });
    await a.db.notes.update(note.id, { deletedAt: T, updatedAt: T });
    expect(await a.repos.backup.trashCount()).toBe(2);
    await a.repos.backup.emptyTrash();
    expect(await a.repos.backup.trashCount()).toBe(0);
    expect(await a.db.cards.count()).toBe(0);
    expect(await a.db.reviewLogs.count()).toBe(0);
    expect(await a.db.decks.count()).toBe(1);
  });

  it("purges only what was deleted long enough ago", async () => {
    const { card, note } = await seed(a.db);
    await a.db.cards.update(card.id, { deletedAt: T - 31 * DAY, updatedAt: T - 31 * DAY });
    await a.db.notes.update(note.id, { deletedAt: T - DAY, updatedAt: T - DAY });
    await a.repos.backup.purgeTrash(30 * DAY);
    expect(await a.db.cards.count()).toBe(0);
    expect(await a.db.notes.count()).toBe(1);
  });
});
