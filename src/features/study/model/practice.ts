/**
 * Infinite mode session (docs/05 › Modo infinito). Pure and in memory only: answers steer the
 * draw and can be undone, but nothing here touches FSRS or the database.
 */
import type { Card } from "../../../domain/model";
import { nextPractice, practicePool } from "../../../domain/queue";
import type { Rating } from "../../../domain/scheduler";

const UNDO_LIMIT = 20;

interface PracticeStep {
  cardId: string;
  /** The card's rating before this answer (undefined = not rated in this session yet). */
  ratingBefore: Rating | undefined;
}

export interface PracticeData {
  pool: string[];
  lastRating: Record<string, Rating>;
  /** Answers that can be undone, oldest first. */
  history: PracticeStep[];
  currentId: string | null;
  /** Answers given in this session. */
  answered: number;
}

export function startPractice(cards: readonly Card[], random: () => number): PracticeData {
  const pool = practicePool(cards);
  return {
    pool,
    lastRating: {},
    history: [],
    currentId: nextPractice({ pool, lastRating: {}, previousId: null, random }),
    answered: 0,
  };
}

export function answerPractice(
  data: PracticeData,
  rating: Rating,
  random: () => number,
): PracticeData {
  const cardId = data.currentId;
  if (cardId === null) return data;
  const lastRating = { ...data.lastRating, [cardId]: rating };
  return {
    ...data,
    lastRating,
    history: [...data.history, { cardId, ratingBefore: data.lastRating[cardId] }].slice(
      -UNDO_LIMIT,
    ),
    currentId: nextPractice({ pool: data.pool, lastRating, previousId: cardId, random }),
    answered: data.answered + 1,
  };
}

export function undoPractice(data: PracticeData): PracticeData {
  const step = data.history[data.history.length - 1];
  if (!step) return data;
  const { [step.cardId]: _, ...others } = data.lastRating;
  return {
    ...data,
    lastRating:
      step.ratingBefore === undefined ? others : { ...others, [step.cardId]: step.ratingBefore },
    history: data.history.slice(0, -1),
    currentId: step.cardId,
    answered: data.answered - 1,
  };
}

/** A card left the session (buried or suspended): drop it and deal another if it was showing. */
export function removeFromPractice(
  data: PracticeData,
  cardId: string,
  random: () => number,
): PracticeData {
  const pool = data.pool.filter((id) => id !== cardId);
  return {
    ...data,
    pool,
    history: data.history.filter((step) => step.cardId !== cardId),
    currentId:
      data.currentId === cardId
        ? nextPractice({ pool, lastRating: data.lastRating, previousId: null, random })
        : data.currentId,
  };
}

/** Undoing a bury or suspend: the card is back in the pool and shows again. */
export function restoreToPractice(data: PracticeData, cardId: string): PracticeData {
  return {
    ...data,
    pool: data.pool.includes(cardId) ? data.pool : [...data.pool, cardId],
    currentId: cardId,
  };
}
