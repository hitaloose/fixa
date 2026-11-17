import { beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { makeDeck, makePreset } from "../../../tests/factories";
import { type Deck, defaultPresetValues, type Preset } from "../../domain/model";
import { fixedClock } from "../../lib/clock";
import type { FixaDb } from "../db";
import { createRepositories } from "./index";

const T = 9_000_000_000_000;
let db: FixaDb;
let repos: ReturnType<typeof createRepositories>;
let standard: Preset;
let custom: Preset;
let deck: Deck;

beforeEach(async () => {
  db = testDb();
  let n = 0;
  const ids = { next: () => `00000000-0000-7000-9000-${(++n).toString(16).padStart(12, "0")}` };
  repos = createRepositories({ db, clock: fixedClock(T), ids });
  standard = makePreset({ name: "Padrão" });
  custom = makePreset({ name: "Intenso", newPerDay: 50, learningSteps: ["5m"] });
  deck = makeDeck({ presetId: custom.id });
  await db.presets.bulkAdd([standard, custom]);
  await db.decks.add(deck);
});

describe("presets.clone", () => {
  it("creates a new preset with the given name and values", async () => {
    const values = { ...defaultPresetValues(), newPerDay: 7 };
    const clone = await repos.presets.clone("Cópia", values);
    expect(clone).toMatchObject({ name: "Cópia", newPerDay: 7, createdAt: T, deletedAt: null });
    expect(clone.id).not.toBe(custom.id);
    expect(await db.presets.get(clone.id)).toEqual(clone);
  });
});

describe("presets.remove", () => {
  it("moves the decks that used it to the fallback preset, then deletes it", async () => {
    await repos.presets.remove(custom.id, standard.id);
    expect((await db.decks.get(deck.id))?.presetId).toBe(standard.id);
    expect((await db.presets.get(custom.id))?.deletedAt).toBe(T);
  });

  it("refuses to delete the fallback preset itself", async () => {
    await expect(repos.presets.remove(standard.id, standard.id)).rejects.toThrow(
      "the default preset cannot be deleted",
    );
  });
});

describe("presets.restoreDefaults", () => {
  it("resets every value but keeps the name and identity", async () => {
    const restored = await repos.presets.restoreDefaults(custom.id);
    expect(restored).toEqual({
      ...custom,
      ...defaultPresetValues(),
      name: "Intenso",
      updatedAt: T,
    });
  });
});

describe("presets.usage", () => {
  it("counts the active decks using each preset", async () => {
    await db.decks.bulkAdd([
      makeDeck({ presetId: custom.id }),
      makeDeck({ presetId: custom.id, deletedAt: T, updatedAt: T }),
    ]);
    expect(await repos.presets.usage()).toEqual({ [custom.id]: 2 });
  });
});

describe("decks.applyOptions", () => {
  it("saves the preset values and the deck's preset and overrides together", async () => {
    await repos.decks.applyOptions({
      deckId: deck.id,
      presetId: standard.id,
      values: { ...defaultPresetValues(), newPerDay: 3 },
      overrides: { reviewsPerDay: 9 },
    });
    expect((await db.presets.get(standard.id))?.newPerDay).toBe(3);
    expect(await db.decks.get(deck.id)).toMatchObject({
      presetId: standard.id,
      overrides: { reviewsPerDay: 9 },
      updatedAt: T,
    });
  });

  it("writes nothing when a value is invalid", async () => {
    await expect(
      repos.decks.applyOptions({
        deckId: deck.id,
        presetId: standard.id,
        values: { ...defaultPresetValues(), desiredRetention: 2 },
        overrides: { reviewsPerDay: 9 },
      }),
    ).rejects.toThrow();
    expect((await db.decks.get(deck.id))?.overrides).toEqual({});
  });
});
