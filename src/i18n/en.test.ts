import { describe, expect, it } from "vitest";
import { en } from "./en";
import { t as ptBR } from "./pt-BR";

/** Every leaf path ("decks.form.name"), so a missing or extra key fails loudly. */
function paths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    paths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("en messages", () => {
  it("has exactly the same keys as pt-BR", () => {
    expect(paths(en).sort()).toEqual(paths(ptBR).sort());
  });

  it.each([
    ["minutes", 6, "6 min"],
    ["hours", 1, "1 h"],
    ["days", 1, "1 day"],
    ["days", 4, "4 days"],
    ["months", 1, "1 month"],
    ["months", 1.5, "1.5 months"],
    ["months", 2, "2 months"],
    ["years", 1, "1 year"],
    ["years", 2.3, "2.3 years"],
  ] as const)("%s(%f) = %s", (unit, n, expected) => {
    expect(en.interval[unit](n)).toBe(expected);
  });

  it("pluralises counts", () => {
    expect(en.decks.todayCards(1)).toBe("1 card");
    expect(en.decks.todayCards(3)).toBe("3 cards");
    expect(en.decks.counts({ new: 1, learning: 2, review: 3 })).toBe(
      "1 new, 2 learning, 3 to review",
    );
  });
});
