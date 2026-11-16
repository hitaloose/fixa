import { describe, expect, it } from "vitest";
import { testDb } from "../../tests/db";
import { fixedClock } from "../lib/clock";
import { ensureSeed, SEED_IDS, type SeedLabels } from "./seed";

const labels: SeedLabels = {
  presetName: "Padrão",
  basic: "Básico",
  basicReversed: "Básico (e invertido)",
  cloze: "Omissão",
  front: "Frente",
  back: "Verso",
  text: "Texto",
  extra: "Verso extra",
  card: (n) => `Cartão ${n}`,
};
const T0 = 3_000_000;

function setup() {
  const db = testDb();
  const clock = fixedClock(T0);
  return { db, clock, seed: () => ensureSeed({ db, clock }, labels) };
}

describe("ensureSeed", () => {
  it("creates the default preset with the documented defaults", async () => {
    const { db, seed } = setup();
    await seed();
    expect(await db.presets.get(SEED_IDS.preset)).toMatchObject({
      name: "Padrão",
      newPerDay: 20,
      reviewsPerDay: 200,
      createdAt: T0,
      deletedAt: null,
    });
  });

  it("creates Básico with Frente/Verso and one card template", async () => {
    const { db, seed } = setup();
    await seed();
    const basic = await db.noteTypes.get(SEED_IDS.basic);
    expect(basic).toMatchObject({ name: "Básico", kind: "standard" });
    expect(basic?.fields.map((f) => f.name)).toEqual(["Frente", "Verso"]);
    expect(basic?.templates).toEqual([
      {
        id: "card1",
        name: "Cartão 1",
        front: "{{Frente}}",
        back: "{{FrontSide}}<hr id=answer>{{Verso}}",
      },
    ]);
  });

  it("creates Básico (e invertido) with a reversed second template", async () => {
    const { db, seed } = setup();
    await seed();
    const reversed = await db.noteTypes.get(SEED_IDS.basicReversed);
    expect(reversed?.templates.map((t) => [t.name, t.front])).toEqual([
      ["Cartão 1", "{{Frente}}"],
      ["Cartão 2", "{{Verso}}"],
    ]);
  });

  it("creates Omissão as a cloze type over Texto", async () => {
    const { db, seed } = setup();
    await seed();
    const cloze = await db.noteTypes.get(SEED_IDS.cloze);
    expect(cloze).toMatchObject({ kind: "cloze" });
    expect(cloze?.fields.map((f) => f.name)).toEqual(["Texto", "Verso extra"]);
    expect(cloze?.templates).toEqual([
      {
        id: "cloze",
        name: "Omissão",
        front: "{{cloze:Texto}}",
        back: "{{cloze:Texto}}<br>{{Verso extra}}",
      },
    ]);
  });

  it("is idempotent: a second run creates and changes nothing", async () => {
    const { db, clock, seed } = setup();
    await seed();
    const before = { presets: await db.presets.toArray(), types: await db.noteTypes.toArray() };
    clock.advance(1_000);
    await seed();
    expect(await db.presets.toArray()).toEqual(before.presets);
    expect(await db.noteTypes.toArray()).toEqual(before.types);
  });

  it("never overwrites a seed entity the user edited", async () => {
    const { db, seed } = setup();
    await seed();
    await db.presets.update(SEED_IDS.preset, { name: "Meu padrão" });
    await seed();
    expect((await db.presets.get(SEED_IDS.preset))?.name).toBe("Meu padrão");
  });

  it("does not resurrect a seed note type the user deleted", async () => {
    const { db, seed } = setup();
    await seed();
    await db.noteTypes.update(SEED_IDS.cloze, { deletedAt: T0 + 1 });
    await seed();
    expect((await db.noteTypes.get(SEED_IDS.cloze))?.deletedAt).toBe(T0 + 1);
  });
});
