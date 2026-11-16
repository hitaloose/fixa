import { buildDeckTree, deckPath } from "../../../domain/decks";
import type { Card, Deck, Preset, ReviewLog } from "../../../domain/model";
import type { QueueCounts } from "../../../domain/queue";
import {
  averageAnswerMs,
  type DayCount,
  estimateMinutes,
  forecastReviews,
} from "../../../domain/stats";
import { countsByDeck } from "./deckList";

export interface DeckOverviewInput {
  decks: Deck[];
  presets: Preset[];
  /** Study candidates, for today's counts. */
  cards: Card[];
  /** All active cards of the deck and its subdecks, for the forecast. */
  deckCards: Card[];
  logsToday: ReviewLog[];
  recentLogs: ReviewLog[];
  now: number;
  cutoffHour: number;
  timeZone: string;
}

export interface DeckOverview {
  deck: Deck;
  path: string;
  counts: QueueCounts;
  minutes: number;
  forecast: DayCount[];
  subdecks: { deck: Deck; counts: QueueCounts }[];
}

const ZERO: QueueCounts = { new: 0, learning: 0, review: 0 };

export function buildDeckOverview(deckId: string, input: DeckOverviewInput): DeckOverview | null {
  const deck = input.decks.find((d) => d.id === deckId);
  if (!deck) return null;
  const counts = countsByDeck(input);
  const countsOf = (id: string) => counts.get(id) ?? ZERO;
  const own = countsOf(deckId);
  const node = buildDeckTree(input.decks.map((d) => ({ ...d, collapsed: false })))
    .flatMap(function flat(n): (typeof n)[] {
      return [n, ...n.children.flatMap(flat)];
    })
    .find((n) => n.deck.id === deckId);
  return {
    deck,
    path: deckPath(deckId, input.decks),
    counts: own,
    minutes: estimateMinutes(own, averageAnswerMs(input.recentLogs)),
    forecast: forecastReviews(input.deckCards, input.now, input.cutoffHour, input.timeZone),
    subdecks: (node?.children ?? []).map((c) => ({ deck: c.deck, counts: countsOf(c.deck.id) })),
  };
}
