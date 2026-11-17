import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { makeCard, makeNote } from "../../../tests/factories";
import type { Card, Note } from "../model";
import { matches, parseSearch, type SearchContext } from "./index";

const END = 2_000_000_000_000;

function ctx(
  card: Partial<Card> = {},
  note: Partial<Note> = {},
  extra: Partial<SearchContext> = {},
): SearchContext {
  return {
    card: makeCard(card),
    note: makeNote({
      fields: { front: "O <b>Gato</b> preto", back: "the cat" },
      tags: ["animais::felinos", "verbos"],
      ...note,
    }),
    deckPath: "Inglês::Animais",
    noteTypeName: "Básico",
    endOfDay: END,
    ...extra,
  };
}

const hit = (query: string, c: SearchContext = ctx()) => matches(parseSearch(query), c);

describe("parseSearch", () => {
  it("parses terms, keys, negation, quotes, or and groups", () => {
    expect(parseSearch('gato -"cão bravo" deck:Inglês (tag:a or is:new) flag:2')).toEqual({
      type: "and",
      items: [
        { type: "text", value: "gato" },
        { type: "not", item: { type: "text", value: "cão bravo" } },
        { type: "deck", value: "Inglês" },
        {
          type: "or",
          items: [
            { type: "tag", value: "a" },
            { type: "is", value: "new" },
          ],
        },
        { type: "flag", value: 2 },
      ],
    });
  });

  it("reads quoted key values", () => {
    expect(parseSearch('deck:"Inglês::Phrasal verbs"')).toEqual({
      type: "deck",
      value: "Inglês::Phrasal verbs",
    });
  });

  it("is empty for a blank query", () => {
    expect(parseSearch("   ")).toEqual({ type: "and", items: [] });
  });

  it("treats unknown keys and odd input as text", () => {
    expect(parseSearch("x:y")).toEqual({ type: "text", value: "x:y" });
    expect(parseSearch("flag:9")).toEqual({ type: "text", value: "flag:9" });
    expect(parseSearch("is:weird")).toEqual({ type: "text", value: "is:weird" });
  });

  it("tolerates unbalanced parentheses and quotes", () => {
    expect(parseSearch("(gato")).toEqual({ type: "text", value: "gato" });
    expect(parseSearch('"gato preto')).toEqual({ type: "text", value: "gato preto" });
    expect(parseSearch("gato)")).toEqual({ type: "text", value: "gato" });
  });

  it("never throws", () => {
    fc.assert(
      fc.property(fc.string(), (q) => {
        parseSearch(q);
      }),
    );
  });
});

describe("matches", () => {
  it("matches everything for an empty query", () => {
    expect(hit("")).toBe(true);
  });

  it("finds text in any field, ignoring case, accents and HTML", () => {
    expect(hit("gato")).toBe(true);
    expect(hit("GATO PRETO")).toBe(true);
    expect(hit("cat")).toBe(true);
    expect(hit("cão")).toBe(false);
    expect(hit("b>gato")).toBe(false);
    expect(hit("gáto")).toBe(true);
  });

  it("needs every term (and) unless joined by or", () => {
    expect(hit("gato cat")).toBe(true);
    expect(hit("gato dog")).toBe(false);
    expect(hit("dog or cat")).toBe(true);
  });

  it("negates", () => {
    expect(hit("-dog")).toBe(true);
    expect(hit("-gato")).toBe(false);
  });

  it("filters by deck, including subdecks", () => {
    expect(hit("deck:inglês")).toBe(true);
    expect(hit("deck:Ingles::animais")).toBe(true);
    expect(hit("deck:Ingl")).toBe(false);
    expect(hit("deck:Animais")).toBe(false);
  });

  it("filters by tag, including child tags", () => {
    expect(hit("tag:animais")).toBe(true);
    expect(hit("tag:animais::felinos")).toBe(true);
    expect(hit("tag:VERBOS")).toBe(true);
    expect(hit("tag:anim")).toBe(false);
    expect(hit("tag:felinos")).toBe(false);
  });

  it("filters by note type", () => {
    expect(hit("note:básico")).toBe(true);
    expect(hit("note:omissão")).toBe(false);
  });

  it.each([
    ["is:new", { queue: "new" as const }, true],
    ["is:new", { queue: "review" as const, state: "review" as const }, false],
    ["is:learn", { queue: "relearning" as const, state: "relearning" as const }, true],
    ["is:review", { queue: "review" as const, state: "review" as const }, true],
    ["is:review", { queue: "suspended" as const, state: "review" as const }, true],
    ["is:due", { queue: "review" as const, state: "review" as const, due: END - 1 }, true],
    ["is:due", { queue: "review" as const, state: "review" as const, due: END }, false],
    ["is:due", { queue: "new" as const, due: 0 }, false],
    ["is:suspended", { queue: "suspended" as const }, true],
    ["is:buried", { queue: "buried" as const, buriedUntilDay: "2026-11-17" }, true],
    ["is:flagged", { flag: 3 }, true],
    ["is:flagged", { flag: 0 }, false],
    ["flag:3", { flag: 3 }, true],
    ["flag:0", { flag: 3 }, false],
  ])("%s on %j → %s", (query, card, expected) => {
    expect(hit(query, ctx(card))).toBe(expected);
  });
});
