/**
 * Infinite mode (docs/05 › Modo infinito): free practice over every studyable card of a deck.
 * Answers only steer the draw; nothing goes through FSRS or is saved.
 */
import type { Card } from "../model";
import type { Rating } from "../scheduler";
import { studyable } from "./studyable";

/** How likely a card is to be dealt, by the last rating given to it in the session. */
export const PRACTICE_WEIGHT: Readonly<Record<Rating | "unseen", number>> = {
  unseen: 1,
  1: 4,
  2: 2,
  3: 1,
  4: 0.5,
};

/** Ids of the cards infinite mode may deal, in the given order. */
export function practicePool(cards: readonly Card[]): string[] {
  return cards.filter(studyable).map((c) => c.id);
}

export interface PracticeDraw {
  pool: readonly string[];
  lastRating: Readonly<Record<string, Rating>>;
  /** The card just shown: left out of the draw unless it is the only one. */
  previousId: string | null;
  /** Injected source of randomness in [0, 1). */
  random: () => number;
}

/** Weighted random pick of the next card, never the previous one twice in a row. */
export function nextPractice({
  pool,
  lastRating,
  previousId,
  random,
}: PracticeDraw): string | null {
  const candidates = pool.length > 1 ? pool.filter((id) => id !== previousId) : pool;
  const weights = candidates.map((id) => PRACTICE_WEIGHT[lastRating[id] ?? "unseen"]);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const target = random() * total;
  let cumulative = 0;
  for (const [i, id] of candidates.entries()) {
    cumulative += weights[i] as number;
    if (target < cumulative) return id;
  }
  return candidates[candidates.length - 1] ?? null;
}
