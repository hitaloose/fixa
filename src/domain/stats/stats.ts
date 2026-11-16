import { addDays, daysBetween, studyDay } from "../day";
import type { Card, ReviewLog } from "../model";

/** Assumed answer time when there is no history yet. */
export const DEFAULT_ANSWER_MS = 10_000;

export interface DayCount {
  day: string;
  count: number;
}

const SCHEDULED = new Set(["learning", "review", "relearning"]);

/** Cards due on each of the next `days` study days; overdue cards count today. */
export function forecastReviews(
  cards: readonly Card[],
  now: number,
  cutoffHour: number,
  timeZone: string,
  days = 7,
): DayCount[] {
  const today = studyDay(now, cutoffHour, timeZone);
  const counts = Array.from({ length: days }, (_, i) => ({ day: addDays(today, i), count: 0 }));
  for (const card of cards) {
    if (card.deletedAt !== null || !SCHEDULED.has(card.queue)) continue;
    const index = daysBetween(today, studyDay(Math.max(card.due, now), cutoffHour, timeZone));
    const bucket = counts[index];
    if (bucket) bucket.count += 1;
  }
  return counts;
}

/** Mean answer time over review logs (undone ones excluded). */
export function averageAnswerMs(logs: readonly ReviewLog[]): number {
  const answered = logs.filter((l) => l.kind === "review" && l.undoneAt === null);
  if (answered.length === 0) return DEFAULT_ANSWER_MS;
  return Math.round(answered.reduce((sum, l) => sum + l.durationMs, 0) / answered.length);
}

export function estimateMinutes(
  counts: { new: number; learning: number; review: number },
  averageMs: number,
): number {
  return Math.ceil(((counts.new + counts.learning + counts.review) * averageMs) / 60_000);
}
