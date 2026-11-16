import { beforeEach, describe, expect, it } from "vitest";
import { makeDeck } from "../../../tests/factories";
import type { Deck } from "../model";
import {
  buildDeckTree,
  checkMove,
  type DeckNode,
  deckPath,
  parseDeckPath,
  planDeckPath,
  searchTree,
  siblingNameTaken,
  subtreeIds,
  visibleRows,
} from "./index";

let ingles: Deck;
let phrasal: Deck;
let idioms: Deck;
let math: Deck;
let decks: Deck[];

beforeEach(() => {
  ingles = makeDeck({ name: "Inglês" });
  phrasal = makeDeck({ name: "Phrasal verbs", parentId: ingles.id });
  idioms = makeDeck({ name: "Idioms", parentId: ingles.id });
  math = makeDeck({ name: "Matemática" });
  decks = [phrasal, math, idioms, ingles];
});

const names = (nodes: DeckNode[]) => nodes.map((n) => n.deck.name);

describe("parseDeckPath", () => {
  it.each([
    ["Inglês", ["Inglês"]],
    ["Inglês::Phrasal verbs", ["Inglês", "Phrasal verbs"]],
    ["  Inglês :: Phrasal verbs  ", ["Inglês", "Phrasal verbs"]],
  ])("%j → %j", (path, expected) => {
    expect(parseDeckPath(path)).toEqual(expected);
  });

  it.each(["", "   ", "A::", "::A", "A::::B", "A:: ::B"])("rejects %j", (path) => {
    expect(() => parseDeckPath(path)).toThrow(/empty/);
  });
});

describe("deckPath", () => {
  it("joins ancestor names with ::", () => {
    expect(deckPath(phrasal.id, decks)).toBe("Inglês::Phrasal verbs");
    expect(deckPath(math.id, decks)).toBe("Matemática");
  });
});

describe("planDeckPath", () => {
  it("creates every segment when nothing exists", () => {
    expect(planDeckPath("Química::Orgânica", decks)).toEqual({
      existing: null,
      parentId: null,
      missing: ["Química", "Orgânica"],
    });
  });

  it("reuses existing ancestors (case-insensitive) and creates the rest", () => {
    expect(planDeckPath("inglês::Phrasal verbs::Up", decks)).toEqual({
      existing: null,
      parentId: phrasal.id,
      missing: ["Up"],
    });
  });

  it("reports an existing deck when the whole path exists", () => {
    expect(planDeckPath("Inglês::IDIOMS", decks)).toEqual({
      existing: idioms,
      parentId: ingles.id,
      missing: [],
    });
  });
});

describe("siblingNameTaken", () => {
  it("compares names case-insensitively among siblings only", () => {
    expect(siblingNameTaken(" idioms ", ingles.id, decks)).toBe(true);
    expect(siblingNameTaken("Idioms", null, decks)).toBe(false);
  });

  it("ignores the deck being renamed", () => {
    expect(siblingNameTaken("Idioms", ingles.id, decks, idioms.id)).toBe(false);
  });
});

describe("subtreeIds", () => {
  it("includes the deck and all descendants", () => {
    const up = makeDeck({ name: "Up", parentId: phrasal.id });
    expect(subtreeIds(ingles.id, [...decks, up]).sort()).toEqual(
      [ingles.id, phrasal.id, idioms.id, up.id].sort(),
    );
  });
});

describe("checkMove", () => {
  it("allows moving to another parent or to the top level", () => {
    expect(checkMove(idioms.id, math.id, decks)).toBe("ok");
    expect(checkMove(idioms.id, null, decks)).toBe("ok");
  });

  it("refuses moving a deck into itself or its descendants", () => {
    expect(checkMove(ingles.id, ingles.id, decks)).toBe("cycle");
    expect(checkMove(ingles.id, phrasal.id, decks)).toBe("cycle");
  });

  it("refuses when the new parent already has a child with that name", () => {
    const otherIdioms = makeDeck({ name: "idioms", parentId: math.id });
    expect(checkMove(idioms.id, math.id, [...decks, otherIdioms])).toBe("name-taken");
  });
});

describe("buildDeckTree", () => {
  it("nests children and sorts siblings by position, then name (pt-BR)", () => {
    const tree = buildDeckTree(decks);
    expect(names(tree)).toEqual(["Inglês", "Matemática"]);
    expect(names(tree[0]?.children ?? [])).toEqual(["Idioms", "Phrasal verbs"]);
  });

  it("orders by manual position before name", () => {
    const first = makeDeck({ name: "Zoologia", position: 0 });
    const tree = buildDeckTree([{ ...ingles, position: 1 }, { ...math, position: 1 }, first]);
    expect(names(tree)).toEqual(["Zoologia", "Inglês", "Matemática"]);
  });

  it("sorts numbers inside names numerically", () => {
    const tree = buildDeckTree([makeDeck({ name: "Aula 10" }), makeDeck({ name: "Aula 2" })]);
    expect(names(tree)).toEqual(["Aula 2", "Aula 10"]);
  });

  it("sorts accented names naturally", () => {
    const tree = buildDeckTree([
      makeDeck({ name: "Ética" }),
      makeDeck({ name: "Física" }),
      makeDeck({ name: "árabe" }),
    ]);
    expect(names(tree)).toEqual(["árabe", "Ética", "Física"]);
  });

  it("annotates path and depth", () => {
    const [eng] = buildDeckTree(decks);
    expect(eng?.children[1]).toMatchObject({ path: "Inglês::Phrasal verbs", depth: 1 });
  });

  it("shows decks whose parent is missing at the top level", () => {
    const orphan = makeDeck({ name: "Órfão", parentId: "00000000-0000-7000-b000-0000000000ff" });
    expect(names(buildDeckTree([orphan]))).toEqual(["Órfão"]);
  });
});

describe("visibleRows", () => {
  it("flattens the tree depth-first", () => {
    expect(visibleRows(buildDeckTree(decks)).map((n) => n.path)).toEqual([
      "Inglês",
      "Inglês::Idioms",
      "Inglês::Phrasal verbs",
      "Matemática",
    ]);
  });

  it("hides the children of collapsed decks", () => {
    const tree = buildDeckTree([{ ...ingles, collapsed: true }, phrasal, idioms, math]);
    expect(visibleRows(tree).map((n) => n.path)).toEqual(["Inglês", "Matemática"]);
  });
});

describe("searchTree", () => {
  it("keeps matching decks with their ancestors, ignoring case and accents", () => {
    const tree = searchTree(buildDeckTree(decks), "phrasal");
    expect(visibleRows(tree).map((n) => n.path)).toEqual(["Inglês", "Inglês::Phrasal verbs"]);
    expect(visibleRows(searchTree(buildDeckTree(decks), "ingles")).map((n) => n.path)).toEqual([
      "Inglês",
    ]);
  });

  it("expands collapsed ancestors of matches", () => {
    const tree = buildDeckTree([{ ...ingles, collapsed: true }, phrasal, idioms, math]);
    expect(visibleRows(searchTree(tree, "idi")).map((n) => n.path)).toEqual([
      "Inglês",
      "Inglês::Idioms",
    ]);
    const [eng] = searchTree(tree, "idi");
    expect(eng?.deck).toEqual({ ...ingles, collapsed: false });
  });

  it("returns the whole tree for a blank query", () => {
    const tree = buildDeckTree(decks);
    expect(searchTree(tree, "  ")).toBe(tree);
  });

  it("returns nothing when no deck matches", () => {
    expect(searchTree(buildDeckTree(decks), "química")).toEqual([]);
  });
});
