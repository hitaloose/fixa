/**
 * Card browser search (Anki-like syntax): free text, "phrases", deck:, tag:, note:, is:,
 * flag:, negation with -, "or" and parentheses. Parsing never fails: anything it does not
 * understand is searched as text.
 */
import type { Card, Note } from "../model";
import { plainText } from "../notes";

export type IsValue = "new" | "learn" | "review" | "due" | "suspended" | "buried" | "flagged";

export type SearchNode =
  | { type: "and"; items: SearchNode[] }
  | { type: "or"; items: SearchNode[] }
  | { type: "not"; item: SearchNode }
  | { type: "text"; value: string }
  | { type: "deck"; value: string }
  | { type: "tag"; value: string }
  | { type: "note"; value: string }
  | { type: "is"; value: IsValue }
  | { type: "flag"; value: number };

export interface SearchContext {
  card: Card;
  note: Note;
  /** "Inglês::Animais" */
  deckPath: string;
  noteTypeName: string;
  /** End of the current study day (for is:due). */
  endOfDay: number;
}

type Token =
  | { kind: "open"; negated: boolean }
  | { kind: "close" }
  | { kind: "or" }
  | { kind: "term"; negated: boolean; key: string | null; value: string };

const IS_VALUES: readonly string[] = [
  "new",
  "learn",
  "review",
  "due",
  "suspended",
  "buried",
  "flagged",
];

function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < query.length) {
    const c = query[i] as string;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ kind: "close" });
      i++;
      continue;
    }
    const negated = c === "-" && i + 1 < query.length && !/\s/.test(query[i + 1] as string);
    if (negated) i++;
    if (query[i] === "(") {
      tokens.push({ kind: "open", negated });
      i++;
      continue;
    }
    let text = "";
    let key: string | null = null;
    let quoted = false;
    while (i < query.length && !/[\s()]/.test(query[i] as string)) {
      const ch = query[i] as string;
      if (ch === '"') {
        const end = query.indexOf('"', i + 1);
        const stop = end === -1 ? query.length : end;
        text += query.slice(i + 1, stop);
        quoted = true;
        i = stop + 1;
        // A quoted phrase may contain spaces and parentheses: keep reading the term after it.
        continue;
      }
      if (ch === ":" && key === null && !quoted) {
        key = text.toLowerCase();
        text = "";
      } else text += ch;
      i++;
    }
    if (key === null && !quoted && !negated && text.toLowerCase() === "or")
      tokens.push({ kind: "or" });
    else tokens.push({ kind: "term", negated, key, value: text });
  }
  return tokens;
}

function atom(key: string | null, value: string): SearchNode {
  const raw = key === null ? value : `${key}:${value}`;
  if (key === null || value === "") return { type: "text", value: raw };
  if (key === "deck" || key === "tag" || key === "note") return { type: key, value };
  if (key === "is" && IS_VALUES.includes(value.toLowerCase()))
    return { type: "is", value: value.toLowerCase() as IsValue };
  if (key === "flag" && /^[0-7]$/.test(value)) return { type: "flag", value: Number(value) };
  return { type: "text", value: raw };
}

const group = (type: "and" | "or", items: SearchNode[]): SearchNode =>
  items.length === 1 ? (items[0] as SearchNode) : { type, items };

export function parseSearch(query: string): SearchNode {
  const tokens = tokenize(query);
  let pos = 0;

  function parseOr(depth: number): SearchNode {
    const alternatives = [parseAnd(depth)];
    while (tokens[pos]?.kind === "or") {
      pos++;
      alternatives.push(parseAnd(depth));
    }
    return group("or", alternatives);
  }

  function parseAnd(depth: number): SearchNode {
    const items: SearchNode[] = [];
    while (pos < tokens.length) {
      const token = tokens[pos] as Token;
      if (token.kind === "or") break;
      if (token.kind === "close") {
        if (depth > 0) break;
        pos++; // stray ")" at the top level
        continue;
      }
      pos++;
      if (token.kind === "open") {
        const inner = parseOr(depth + 1);
        if (tokens[pos]?.kind === "close") pos++;
        items.push(token.negated ? { type: "not", item: inner } : inner);
      } else {
        const node = atom(token.key, token.value);
        items.push(token.negated ? { type: "not", item: node } : node);
      }
    }
    return items.length === 0 ? { type: "and", items: [] } : group("and", items);
  }

  return parseOr(0);
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

const inHierarchy = (path: string, wanted: string) => {
  const p = normalize(path);
  const w = normalize(wanted);
  return p === w || p.startsWith(`${w}::`);
};

function isState(card: Card, value: IsValue, endOfDay: number): boolean {
  switch (value) {
    case "new":
      return card.queue === "new";
    case "learn":
      return card.queue === "learning" || card.queue === "relearning";
    case "review":
      return card.state === "review" || card.state === "relearning";
    case "due":
      return (
        (card.queue === "review" || card.queue === "learning" || card.queue === "relearning") &&
        card.due < endOfDay
      );
    case "suspended":
      return card.queue === "suspended";
    case "buried":
      return card.queue === "buried";
    case "flagged":
      return card.flag > 0;
  }
}

export function matches(node: SearchNode, ctx: SearchContext): boolean {
  switch (node.type) {
    case "and":
      return node.items.every((n) => matches(n, ctx));
    case "or":
      return node.items.some((n) => matches(n, ctx));
    case "not":
      return !matches(node.item, ctx);
    case "text": {
      const haystack = normalize(Object.values(ctx.note.fields).map(plainText).join(" "));
      return haystack.includes(normalize(node.value));
    }
    case "deck":
      return inHierarchy(ctx.deckPath, node.value);
    case "tag":
      return ctx.note.tags.some((t) => inHierarchy(t, node.value));
    case "note":
      return normalize(ctx.noteTypeName) === normalize(node.value);
    case "is":
      return isState(ctx.card, node.value, ctx.endOfDay);
    case "flag":
      return ctx.card.flag === node.value;
  }
}
