import { describe, expect, it } from "vitest";
import { testDb } from "../../../tests/db";
import { parseDeck } from "../../domain/model";
import { fixedClock } from "../../lib/clock";
import { sequentialIds } from "../../lib/ids";
import { createEntityRepository } from "./entityRepository";

const PRESET = "00000000-0000-7000-a000-000000000001";
const T0 = 1_000_000;

function setup() {
  const db = testDb();
  const clock = fixedClock(T0);
  const repo = createEntityRepository({
    table: db.decks,
    parse: parseDeck,
    clock,
    ids: sequentialIds(),
  });
  return { db, clock, repo };
}

const input = {
  name: "Inglês",
  parentId: null,
  presetId: PRESET,
  description: "",
  collapsed: false,
  overrides: {},
  position: 0,
};

describe("createEntityRepository", () => {
  it("create assigns id and timestamps, and persists the entity", async () => {
    const { db, repo } = setup();
    const deck = await repo.create(input);
    expect(deck).toEqual({
      ...input,
      id: "00000000-0000-7000-8000-000000000001",
      createdAt: T0,
      updatedAt: T0,
      deletedAt: null,
    });
    expect(await db.decks.get(deck.id)).toEqual(deck);
  });

  it("create rejects invalid input and persists nothing", async () => {
    const { db, repo } = setup();
    await expect(repo.create({ ...input, name: "A::B" })).rejects.toThrow();
    expect(await db.decks.count()).toBe(0);
  });

  it("get returns undefined for an unknown id", async () => {
    const { repo } = setup();
    expect(await repo.get("00000000-0000-7000-8000-0000000000ff")).toBeUndefined();
  });

  it("update merges the patch, bumps updatedAt and keeps createdAt", async () => {
    const { clock, repo } = setup();
    const deck = await repo.create(input);
    clock.advance(500);
    const updated = await repo.update(deck.id, { name: "English", collapsed: true });
    expect(updated).toEqual({ ...deck, name: "English", collapsed: true, updatedAt: T0 + 500 });
    expect(await repo.get(deck.id)).toEqual(updated);
  });

  it("update rejects an invalid patch and leaves the stored entity unchanged", async () => {
    const { repo } = setup();
    const deck = await repo.create(input);
    await expect(repo.update(deck.id, { name: "" })).rejects.toThrow();
    expect(await repo.get(deck.id)).toEqual(deck);
  });

  it("update throws for an unknown id", async () => {
    const { repo } = setup();
    await expect(
      repo.update("00000000-0000-7000-8000-0000000000ff", { name: "x" }),
    ).rejects.toThrow(/not found/);
  });

  it("softDelete sets deletedAt and updatedAt, and hides it from listActive", async () => {
    const { clock, repo } = setup();
    const keep = await repo.create(input);
    const gone = await repo.create({ ...input, name: "Velho" });
    clock.advance(10);
    await repo.softDelete(gone.id);
    expect(await repo.get(gone.id)).toMatchObject({ deletedAt: T0 + 10, updatedAt: T0 + 10 });
    expect(await repo.listActive()).toEqual([keep]);
  });

  it("restore clears deletedAt and bumps updatedAt", async () => {
    const { clock, repo } = setup();
    const deck = await repo.create(input);
    await repo.softDelete(deck.id);
    clock.advance(20);
    await repo.restore(deck.id);
    expect(await repo.get(deck.id)).toMatchObject({ deletedAt: null, updatedAt: T0 + 20 });
  });
});
