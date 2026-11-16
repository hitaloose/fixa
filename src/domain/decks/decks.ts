/** Deck hierarchy rules (docs/04-modelo-de-dados.md › Deck): names per node, paths derived. */
import type { Deck } from "../model";

export interface DeckNode {
  deck: Deck;
  /** "Inglês::Phrasal verbs" */
  path: string;
  depth: number;
  children: DeckNode[];
}

export type MoveCheck = "ok" | "cycle" | "name-taken";

const SEPARATOR = "::";
const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
/** `stored` is an existing deck name; `typed` is user input (trimmed here). */
const sameName = (stored: string, typed: string) => collator.compare(stored, typed.trim()) === 0;
/** Lowercase without accents, for search. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

export function parseDeckPath(path: string): string[] {
  const segments = path.split(SEPARATOR).map((s) => s.trim());
  if (segments.some((s) => s === "")) throw new Error(`deck path "${path}" has an empty segment`);
  return segments;
}

const childrenOf = (parentId: string | null, decks: readonly Deck[]) =>
  decks.filter((d) => d.parentId === parentId);

export function deckPath(deckId: string, decks: readonly Deck[]): string {
  const byId = new Map(decks.map((d) => [d.id, d]));
  const names: string[] = [];
  let current = byId.get(deckId);
  while (current) {
    names.unshift(current.name);
    current = byId.get(current.parentId ?? "");
  }
  return names.join(SEPARATOR);
}

/** How to create `path`: which ancestors already exist (matched case-insensitively) and what is missing. */
export function planDeckPath(path: string, decks: readonly Deck[]) {
  let parentId: string | null = null;
  let found: Deck | undefined;
  for (const [i, name] of parseDeckPath(path).entries()) {
    if (found) parentId = found.id;
    found = childrenOf(parentId, decks).find((d) => sameName(d.name, name));
    if (!found) return { existing: null, parentId, missing: parseDeckPath(path).slice(i) };
  }
  return { existing: found ?? null, parentId, missing: [] as string[] };
}

export function siblingNameTaken(
  name: string,
  parentId: string | null,
  decks: readonly Deck[],
  exceptId?: string,
): boolean {
  return childrenOf(parentId, decks).some((d) => d.id !== exceptId && sameName(d.name, name));
}

export function subtreeIds(deckId: string, decks: readonly Deck[]): string[] {
  return [deckId, ...childrenOf(deckId, decks).flatMap((c) => subtreeIds(c.id, decks))];
}

export function checkMove(
  deckId: string,
  newParentId: string | null,
  decks: readonly Deck[],
): MoveCheck {
  if (subtreeIds(deckId, decks).some((id) => id === newParentId)) return "cycle";
  const deck = decks.find((d) => d.id === deckId);
  if (deck && siblingNameTaken(deck.name, newParentId, decks, deckId)) return "name-taken";
  return "ok";
}

const bySiblingOrder = (a: Deck, b: Deck) =>
  a.position - b.position || collator.compare(a.name, b.name);

/** Sorted tree; decks whose parent is missing are shown at the top level. */
export function buildDeckTree(decks: readonly Deck[]): DeckNode[] {
  const ids = new Set(decks.map((d) => d.id));
  const build = (deck: Deck, depth: number, parentPath: string): DeckNode => {
    const path = parentPath ? `${parentPath}${SEPARATOR}${deck.name}` : deck.name;
    const children = childrenOf(deck.id, decks)
      .sort(bySiblingOrder)
      .map((c) => build(c, depth + 1, path));
    return { deck, path, depth, children };
  };
  return decks
    .filter((d) => !ids.has(d.parentId ?? ""))
    .sort(bySiblingOrder)
    .map((d) => build(d, 0, ""));
}

/** Depth-first rows to render, skipping children of collapsed decks. */
export function visibleRows(tree: readonly DeckNode[]): DeckNode[] {
  return tree.flatMap((n) => [n, ...(n.deck.collapsed ? [] : visibleRows(n.children))]);
}

/** Keeps decks whose name matches (case/accent-insensitive) plus their ancestors, expanded. */
export function searchTree(tree: DeckNode[], query: string): DeckNode[] {
  const q = fold(query.trim());
  if (!q) return tree;
  const search = (nodes: readonly DeckNode[]): DeckNode[] =>
    nodes.flatMap((node): DeckNode[] => {
      const children = search(node.children);
      if (children.length > 0)
        return [{ ...node, deck: { ...node.deck, collapsed: false }, children }];
      return fold(node.deck.name).includes(q) ? [{ ...node, children: [] }] : [];
    });
  return search(tree);
}
