/**
 * "Simular carga" (docs/01 › Opções do baralho): how many reviews the next days would bring with
 * a preset. A seeded Monte Carlo over the real scheduler: each due card is recalled with the
 * FSRS probability of recall at that moment, new cards come in up to the daily limit.
 */
import type { Card, Preset } from "../model";
import { seededRandom } from "../queue";
import { answer, type Rating, retrievability } from "../scheduler";
import { DEFAULT_ANSWER_MS } from "./stats";

const DAY_MS = 86_400_000;
/** First answer of a new card: how often it is remembered (no history to estimate it from). */
const NEW_CARD_SUCCESS = 0.75;

export interface SimulationInput {
  cards: readonly Card[];
  preset: Preset;
  days: number;
  now: number;
  seed: string;
  /** Average answer time, for the minutes estimate. */
  answerMs?: number;
}

export interface SimulatedDay {
  /** Days from today (0 = today). */
  day: number;
  reviews: number;
  newCards: number;
  minutes: number;
}

export function simulateWorkload({
  cards,
  preset,
  days,
  now,
  seed,
  answerMs = DEFAULT_ANSWER_MS,
}: SimulationInput): SimulatedDay[] {
  const random = seededRandom(seed);
  // The simulation must not suspend leeches or stop on one.
  const sim: Preset = { ...preset, leechThreshold: Number.MAX_SAFE_INTEGER };
  const live = cards.filter(
    (c) => c.deletedAt === null && c.queue !== "suspended" && c.queue !== "buried",
  );
  let scheduled: Card[] = live.filter((c) => c.state !== "new");
  const pool = live.filter((c) => c.state === "new").sort((a, b) => a.newPosition - b.newPosition);
  let id = 0;
  const step = (card: Card, rating: Rating, at: number): Card =>
    answer({ card, rating, now: at, preset: sim, durationMs: answerMs, logId: `sim-${id++}` })
      .nextCard;

  const result: SimulatedDay[] = [];
  for (let day = 0; day < days; day++) {
    const start = now + day * DAY_MS;
    const end = start + DAY_MS;
    let reviewsLeft = preset.reviewsPerDay;
    let reviews = 0;

    const fresh = pool.splice(0, Math.min(preset.newPerDay, pool.length));
    for (const card of fresh) {
      scheduled.push(step(card, random() < NEW_CARD_SUCCESS ? 3 : 1, start));
    }

    // Same-day learning steps come back, so keep taking the earliest due card.
    for (let guard = 0; reviewsLeft > 0 && guard < 100_000; guard++) {
      let index = -1;
      for (let i = 0; i < scheduled.length; i++) {
        const c = scheduled[i] as Card;
        if (c.due < end && (index === -1 || c.due < (scheduled[index] as Card).due)) index = i;
      }
      if (index === -1) break;
      const card = scheduled[index] as Card;
      const at = Math.max(card.due, start);
      const recalled = random() < retrievability(card, at, sim);
      scheduled[index] = step(card, recalled ? 3 : 1, at);
      reviews++;
      reviewsLeft--;
    }
    // Reviews over the limit wait for the next day.
    scheduled = scheduled.map((c) => (c.due < end ? { ...c, due: end } : c));

    result.push({
      day,
      reviews,
      newCards: fresh.length,
      minutes: Math.ceil(((reviews + fresh.length) * answerMs) / 60_000),
    });
  }
  return result;
}
