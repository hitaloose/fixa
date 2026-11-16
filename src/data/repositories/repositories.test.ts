import { describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { makeCard, makeMedia, makeReviewLog } from "../../../tests/factories";
import { fixedClock } from "../../lib/clock";
import { sequentialIds } from "../../lib/ids";
import { createRepositories } from "./index";

const T0 = 2_000_000;

function setup() {
  const db = testDb();
  const clock = fixedClock(T0);
  return { db, clock, repos: createRepositories({ db, clock, ids: sequentialIds() }) };
}

describe("createRepositories", () => {
  it("presets.create fills documented defaults from an empty input", async () => {
    const { repos } = setup();
    const preset = await repos.presets.create({});
    expect(preset).toMatchObject({ name: "Padrão", newPerDay: 20, createdAt: T0 });
  });
});

describe("reviewLogs", () => {
  it("append stores a validated log", async () => {
    const { db, repos } = setup();
    const log = makeReviewLog();
    await repos.reviewLogs.append(log);
    expect(await db.reviewLogs.get(log.id)).toEqual(log);
  });

  it("append rejects an invalid log", async () => {
    const { db, repos } = setup();
    await expect(repos.reviewLogs.append({ ...makeReviewLog(), rating: 7 })).rejects.toThrow();
    expect(await db.reviewLogs.count()).toBe(0);
  });

  it("append never overwrites an existing log (append-only)", async () => {
    const { db, repos } = setup();
    const log = makeReviewLog();
    await repos.reviewLogs.append(log);
    await expect(repos.reviewLogs.append({ ...log, rating: 1 })).rejects.toThrow();
    expect(await db.reviewLogs.get(log.id)).toEqual(log);
  });

  it("byCard returns that card's logs in review order", async () => {
    const { repos } = setup();
    const card = makeCard();
    const late = makeReviewLog({ cardId: card.id, reviewedAt: 300 });
    const early = makeReviewLog({ cardId: card.id, reviewedAt: 100 });
    const other = makeReviewLog({ reviewedAt: 200 });
    for (const l of [late, other, early]) await repos.reviewLogs.append(l);
    expect(await repos.reviewLogs.byCard(card.id)).toEqual([early, late]);
  });

  it("markUndone sets undoneAt without deleting the log", async () => {
    const { clock, repos } = setup();
    const log = makeReviewLog();
    await repos.reviewLogs.append(log);
    clock.advance(7);
    await repos.reviewLogs.markUndone(log.id);
    expect(await repos.reviewLogs.byCard(log.cardId)).toEqual([{ ...log, undoneAt: T0 + 7 }]);
  });
});

describe("media", () => {
  it("put stores media and get returns it", async () => {
    const { repos } = setup();
    const media = makeMedia();
    await repos.media.put(media);
    expect(await repos.media.get(media.id)).toMatchObject({
      id: media.id,
      fileName: media.fileName,
    });
  });

  it("put is idempotent for the same content hash and keeps the first record", async () => {
    const { db, repos } = setup();
    const media = makeMedia();
    await repos.media.put(media);
    const again = await repos.media.put({ ...media, fileName: "renamed.png" });
    expect(again.fileName).toBe(media.fileName);
    expect(await db.media.count()).toBe(1);
  });
});

describe("settings", () => {
  it("get returns the default when nothing is stored", async () => {
    const { repos } = setup();
    expect(await repos.settings.get("cutoffHour")).toBe(4);
  });

  it("set persists a value that get returns", async () => {
    const { repos } = setup();
    await repos.settings.set("lastBackupAt", 123);
    expect(await repos.settings.get("lastBackupAt")).toBe(123);
  });

  it("set rejects an invalid value", async () => {
    const { repos } = setup();
    await expect(repos.settings.set("cutoffHour", 24)).rejects.toThrow();
    expect(await repos.settings.get("cutoffHour")).toBe(4);
  });
});
