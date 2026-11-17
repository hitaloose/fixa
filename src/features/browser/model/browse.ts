/** Card browser listing: search, group by note, sort (pure; data is loaded by the hook). */
import { deckPath } from "../../../domain/decks";
import type { Card, Deck, Note, NoteType } from "../../../domain/model";
import { matches, parseSearch } from "../../../domain/search";

export type SortKey = "added" | "due" | "text" | "modified";
export type BrowseMode = "cards" | "notes";
export type CardStatus = "new" | "learning" | "review" | "suspended" | "buried";

export interface BrowseData {
  cards: Card[];
  notes: Note[];
  decks: Deck[];
  noteTypes: NoteType[];
  endOfDay: number;
}

export interface BrowseOptions {
  query: string;
  sort: SortKey;
  mode: BrowseMode;
}

export interface BrowseRow {
  /** Card id (cards mode) or note id (notes mode). */
  id: string;
  noteId: string;
  /** Matching cards of the row (one in cards mode). */
  cardIds: string[];
  text: string;
  deckPath: string;
  status: CardStatus;
  due: number;
}

const statusOf = (card: Card): CardStatus =>
  card.queue === "relearning" ? "learning" : card.queue;

interface Hit {
  card: Card;
  note: Note;
  deckPath: string;
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
/** New cards have no real due date: they go last, in introduction order. */
const dueKey = (c: Card) => (c.queue === "new" ? [1, c.newPosition] : [0, c.due]);
const compareDue = (a: Card, b: Card) => {
  const [ga, va] = dueKey(a) as [number, number];
  const [gb, vb] = dueKey(b) as [number, number];
  return ga - gb || va - vb;
};

function compareHits(sort: SortKey) {
  return (a: Hit, b: Hit): number => {
    const tie = a.card.templateOrd - b.card.templateOrd;
    switch (sort) {
      case "added":
        return b.card.createdAt - a.card.createdAt || tie;
      case "due":
        return compareDue(a.card, b.card) || tie;
      case "text":
        return collator.compare(a.note.sortField, b.note.sortField) || tie;
      case "modified":
        return (
          Math.max(b.card.updatedAt, b.note.updatedAt) -
            Math.max(a.card.updatedAt, a.note.updatedAt) || tie
        );
    }
  };
}

export function browse(data: BrowseData, { query, sort, mode }: BrowseOptions): BrowseRow[] {
  const ast = parseSearch(query);
  const notes = new Map(data.notes.map((n) => [n.id, n]));
  const noteTypes = new Map(data.noteTypes.map((nt) => [nt.id, nt.name]));
  const paths = new Map(data.decks.map((d) => [d.id, deckPath(d.id, data.decks)]));

  const hits: Hit[] = [];
  for (const card of data.cards) {
    const note = notes.get(card.noteId);
    if (!note) continue;
    const path = paths.get(card.deckId) ?? "";
    const ctx = {
      card,
      note,
      deckPath: path,
      noteTypeName: noteTypes.get(note.noteTypeId) ?? "",
      endOfDay: data.endOfDay,
    };
    if (matches(ast, ctx)) hits.push({ card, note, deckPath: path });
  }
  hits.sort(compareHits(sort));

  const row = (hit: Hit, id: string, cardIds: string[]): BrowseRow => ({
    id,
    noteId: hit.note.id,
    cardIds,
    text: hit.note.sortField,
    deckPath: hit.deckPath,
    status: statusOf(hit.card),
    due: hit.card.due,
  });

  if (mode === "cards") return hits.map((h) => row(h, h.card.id, [h.card.id]));

  // Notes mode: one row per note, placed where its first (best-sorted) card would be.
  const byNote = new Map<string, { first: Hit; cardIds: string[] }>();
  for (const hit of hits) {
    const entry = byNote.get(hit.note.id);
    if (entry) entry.cardIds.push(hit.card.id);
    else byNote.set(hit.note.id, { first: hit, cardIds: [hit.card.id] });
  }
  return [...byNote.values()].map(({ first, cardIds }) => row(first, first.note.id, cardIds));
}

/** Adds the term to the query, or removes it when present (quick filter chips). */
export function toggleTerm(query: string, term: string): string {
  const parts = query.split(/\s+/).filter((p) => p !== "");
  const next = parts.includes(term) ? parts.filter((p) => p !== term) : [...parts, term];
  return next.join(" ");
}
