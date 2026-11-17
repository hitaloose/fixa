import { describe, expect, it } from "vitest";
import { makeDeck, makePreset } from "../../../../tests/factories";
import { type LimitDraft, limitDraft, overridesFrom } from "./limits";

const TODAY = "2026-11-16";
const preset = makePreset({ newPerDay: 20, reviewsPerDay: 200 });

describe("limitDraft", () => {
  it("uses the preset when the deck has no override", () => {
    expect(limitDraft(makeDeck(), preset, "newPerDay", TODAY)).toEqual({
      scope: "preset",
      deck: 20,
      today: 20,
    });
  });

  it("uses the deck's own limit when set", () => {
    const deck = makeDeck({ overrides: { newPerDay: 5 } });
    expect(limitDraft(deck, preset, "newPerDay", TODAY)).toEqual({
      scope: "deck",
      deck: 5,
      today: 5,
    });
  });

  it("uses today's limit only on its day", () => {
    const deck = makeDeck({
      overrides: { reviewsPerDay: 50, todayOnly: { day: TODAY, reviewsPerDay: 10 } },
    });
    expect(limitDraft(deck, preset, "reviewsPerDay", TODAY)).toEqual({
      scope: "today",
      deck: 50,
      today: 10,
    });
    expect(limitDraft(deck, preset, "reviewsPerDay", "2026-11-17").scope).toBe("deck");
    expect(limitDraft(deck, preset, "newPerDay", TODAY).scope).toBe("preset");
  });
});

describe("overridesFrom", () => {
  const draft = (scope: LimitDraft["scope"], deck = 7, today = 3): LimitDraft => ({
    scope,
    deck,
    today,
  });

  it("clears overrides for fields that follow the preset", () => {
    const current = { newPerDay: 5, todayOnly: { day: TODAY, newPerDay: 1 } };
    expect(
      overridesFrom(current, { newPerDay: draft("preset"), reviewsPerDay: draft("preset") }, TODAY),
    ).toEqual({});
  });

  it("stores this deck's limit and drops today's for that field", () => {
    const current = { todayOnly: { day: TODAY, newPerDay: 1, reviewsPerDay: 2 } };
    expect(
      overridesFrom(current, { newPerDay: draft("deck"), reviewsPerDay: draft("today") }, TODAY),
    ).toEqual({ newPerDay: 7, todayOnly: { day: TODAY, reviewsPerDay: 3 } });
  });

  it("keeps the deck's limit underneath a today-only limit", () => {
    const current = { newPerDay: 5 };
    expect(
      overridesFrom(current, { newPerDay: draft("today"), reviewsPerDay: draft("preset") }, TODAY),
    ).toEqual({ newPerDay: 5, todayOnly: { day: TODAY, newPerDay: 3 } });
  });

  it("forgets today-only limits from another day", () => {
    const current = { todayOnly: { day: "2026-11-15", newPerDay: 1 } };
    expect(
      overridesFrom(current, { newPerDay: draft("preset"), reviewsPerDay: draft("today") }, TODAY),
    ).toEqual({ todayOnly: { day: TODAY, reviewsPerDay: 3 } });
  });
});
