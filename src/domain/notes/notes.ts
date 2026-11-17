/** Pure note rules: plain text for sorting/duplicates, tags, cloze numbering, card plans. */
import type { Card } from "../model";
import { clozeNumbers } from "../templates";

const BLOCK_TAG = /<\/?(?:br|div|p|li|tr|td|th|h[1-6]|blockquote|pre|hr)\b[^>]*>/gi;
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** Field HTML as plain text: what sortField holds and what the duplicate checksum hashes. */
export function plainText(html: string): string {
  return html
    .replace(BLOCK_TAG, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, " ")
    .trim();
}

/** Tags typed by the user: separated by spaces or commas, lowercase, without duplicates. */
export function parseTags(input: string): string[] {
  const tags = input
    .split(/[\s,]+/)
    .filter((t) => t !== "")
    .map((t) => t.toLocaleLowerCase("pt-BR"));
  return [...new Set(tags)];
}

/** The number a new cloze deletion should get: one more than any in the note. */
export function nextClozeNumber(fields: readonly string[]): number {
  return Math.max(0, ...fields.flatMap(clozeNumbers)) + 1;
}

export interface CardPlan {
  /** Template ords that need a brand-new card. */
  create: number[];
  /** Soft-deleted cards to bring back (their review history is kept). */
  restore: string[];
  /** Active cards whose template no longer generates a card (soft-deleted). */
  remove: string[];
}

/** What to do with a note's cards after an edit changes which templates generate cards. */
export function planCardChanges(generated: readonly number[], cards: readonly Card[]): CardPlan {
  const wanted = new Set(generated);
  const plan: CardPlan = { create: [], restore: [], remove: [] };
  for (const ord of wanted) {
    const active = cards.some((c) => c.templateOrd === ord && c.deletedAt === null);
    if (active) continue;
    const removed = cards.find((c) => c.templateOrd === ord);
    if (removed) plan.restore.push(removed.id);
    else plan.create.push(ord);
  }
  for (const c of cards) {
    if (c.deletedAt === null && !wanted.has(c.templateOrd)) plan.remove.push(c.id);
  }
  return plan;
}

export interface NewCardInput {
  id: string;
  noteId: string;
  deckId: string;
  templateOrd: number;
  now: number;
}

/** A never-studied card. New cards are introduced in creation order, like Anki. */
export function newCard({ id, noteId, deckId, templateOrd, now }: NewCardInput): Card {
  return {
    id,
    noteId,
    deckId,
    templateOrd,
    queue: "new",
    state: "new",
    buriedUntilDay: null,
    newPosition: now,
    due: now,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    learningStep: 0,
    reps: 0,
    lapses: 0,
    lastReviewAt: null,
    flag: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}
