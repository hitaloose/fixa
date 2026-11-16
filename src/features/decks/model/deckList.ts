import { endOfStudyDay, startOfStudyDay, studyDay } from "../../../domain/day";
import { buildDeckTree, type DeckNode, searchTree, visibleRows } from "../../../domain/decks";
import type { Card, Deck, Preset, ReviewLog } from "../../../domain/model";
import { buildQueue, doneTodayFrom, type QueueCounts } from "../../../domain/queue";
import { averageAnswerMs, estimateMinutes } from "../../../domain/stats";

export interface DeckListInput {
  decks: Deck[];
  presets: Preset[];
  /** Study candidates (see cards.studyCandidates). */
  cards: Card[];
  /** Review logs since the start of the study day. */
  logsToday: ReviewLog[];
  /** Latest logs, for the average answer time. */
  recentLogs: ReviewLog[];
  now: number;
  cutoffHour: number;
  timeZone: string;
  query: string;
}

export interface DeckRow {
  node: DeckNode;
  counts: QueueCounts;
  hasChildren: boolean;
}

export interface DaySummary {
  counts: QueueCounts;
  minutes: number;
}

export interface DeckList {
  rows: DeckRow[];
  summary: DaySummary;
  /** Every active deck, unfiltered. */
  allDecks: Deck[];
}

/** Today's counts for each deck, as Anki shows them: limits applied, subdecks included. */
export function countsByDeck(
  input: Omit<DeckListInput, "query" | "recentLogs">,
): Map<string, QueueCounts> {
  const { decks, presets, cards, logsToday, now, cutoffHour, timeZone } = input;
  const today = studyDay(now, cutoffHour, timeZone);
  const endOfDay = endOfStudyDay(now, cutoffHour, timeZone);
  const deckOfCard = new Map(cards.map((c) => [c.id, c.deckId]));
  const doneToday = doneTodayFrom(
    logsToday,
    deckOfCard,
    startOfStudyDay(now, cutoffHour, timeZone),
  );
  return new Map(
    decks.map((deck) => [
      deck.id,
      buildQueue({
        rootDeckId: deck.id,
        decks,
        presets,
        cards,
        now,
        today,
        endOfDay,
        doneToday,
        seed: `${today}:${deck.id}`,
      }).counts,
    ]),
  );
}

const ZERO: QueueCounts = { new: 0, learning: 0, review: 0 };
const add = (a: QueueCounts, b: QueueCounts): QueueCounts => ({
  new: a.new + b.new,
  learning: a.learning + b.learning,
  review: a.review + b.review,
});

export function buildDeckList(input: DeckListInput): DeckList {
  const counts = countsByDeck(input);
  const tree = buildDeckTree(input.decks);
  const rows = visibleRows(searchTree(tree, input.query)).map((node) => ({
    node,
    counts: counts.get(node.deck.id) ?? ZERO,
    hasChildren: node.children.length > 0 || input.decks.some((d) => d.parentId === node.deck.id),
  }));
  const total = tree.reduce((sum, root) => add(sum, counts.get(root.deck.id) ?? ZERO), ZERO);
  return {
    rows,
    summary: { counts: total, minutes: estimateMinutes(total, averageAnswerMs(input.recentLogs)) },
    allDecks: input.decks,
  };
}
