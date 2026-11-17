/**
 * Statistics screen (docs/01-produto.md › Estatísticas). Pure: answers are grouped by study
 * day (hour de corte), undone logs and non-answers (reset/reschedule) are ignored.
 */
import { addDays, studyDay } from "../day";
import type { Card, ReviewLog } from "../model";

export interface StatsInput {
  logs: readonly ReviewLog[];
  cards: readonly Card[];
  now: number;
  cutoffHour: number;
  timeZone: string;
  /** Length of the chosen period, ending today. */
  periodDays: number;
}

export interface DayActivity {
  day: string;
  reviews: number;
  ms: number;
}

export interface StatsView {
  today: { reviews: number; minutes: number; again: number; correctRate: number | null };
  /** One entry per day of the period, oldest first, ending today. */
  daily: DayActivity[];
  /** The last 365 days, oldest first. */
  heatmap: DayActivity[];
  /** Answers on review cards that were not "again" (Anki's true retention). */
  retention: { passed: number; total: number; rate: number | null };
  /** Consecutive study days ending today (or yesterday, if today has none yet). */
  streak: number;
  time: { totalMinutes: number; minutesPerDay: number };
  cardStates: { new: number; learning: number; review: number; suspended: number; buried: number };
  buttons: Record<1 | 2 | 3 | 4, number>;
}

const HEATMAP_DAYS = 365;
const MINUTE = 60_000;

function series(byDay: Map<string, DayActivity>, today: string, days: number): DayActivity[] {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    return byDay.get(day) ?? { day, reviews: 0, ms: 0 };
  });
}

export function buildStats({
  logs,
  cards,
  now,
  cutoffHour,
  timeZone,
  periodDays,
}: StatsInput): StatsView {
  const today = studyDay(now, cutoffHour, timeZone);
  const periodStart = addDays(today, 1 - periodDays);
  const answers = logs
    .filter((l) => l.kind === "review" && l.undoneAt === null)
    .map((log) => ({ log, day: studyDay(log.reviewedAt, cutoffHour, timeZone) }));

  const byDay = new Map<string, DayActivity>();
  for (const { log, day } of answers) {
    const entry = byDay.get(day) ?? { day, reviews: 0, ms: 0 };
    entry.reviews += 1;
    entry.ms += log.durationMs;
    byDay.set(day, entry);
  }

  const todays = answers.filter((a) => a.day === today).map((a) => a.log);
  const inPeriod = answers.filter((a) => a.day >= periodStart && a.day <= today).map((a) => a.log);
  const reviewAnswers = inPeriod.filter((l) => l.stateBefore === "review");
  const passed = reviewAnswers.filter((l) => l.rating > 1).length;

  let streak = 0;
  let day = byDay.has(today) ? today : addDays(today, -1);
  while (byDay.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }

  const daily = series(byDay, today, periodDays);
  const totalMs = daily.reduce((sum, d) => sum + d.ms, 0);

  const buttons: StatsView["buttons"] = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const l of inPeriod) buttons[l.rating as 1 | 2 | 3 | 4] += 1;

  const cardStates = { new: 0, learning: 0, review: 0, suspended: 0, buried: 0 };
  for (const c of cards) cardStates[c.queue === "relearning" ? "learning" : c.queue] += 1;

  return {
    today: {
      reviews: todays.length,
      minutes: Math.round(todays.reduce((s, l) => s + l.durationMs, 0) / MINUTE),
      again: todays.filter((l) => l.rating === 1).length,
      correctRate:
        todays.length === 0 ? null : todays.filter((l) => l.rating > 1).length / todays.length,
    },
    daily,
    heatmap: series(byDay, today, HEATMAP_DAYS),
    retention: {
      passed,
      total: reviewAnswers.length,
      rate: reviewAnswers.length === 0 ? null : passed / reviewAnswers.length,
    },
    streak,
    time: {
      totalMinutes: Math.round(totalMs / MINUTE),
      minutesPerDay: Math.round((totalMs / MINUTE / periodDays) * 10) / 10,
    },
    cardStates,
    buttons,
  };
}
