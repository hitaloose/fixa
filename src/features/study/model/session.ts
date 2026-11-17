/**
 * Study session state (docs/05-agendamento.md › fila em memória). Pure: the session keeps the
 * cards of the studied deck in memory and rebuilds the queue after every action, so the screen
 * moves on without waiting for IndexedDB; the hook persists each change.
 */
import { endOfStudyDay, startOfStudyDay, studyDay } from "../../../domain/day";
import type { Card, Deck, Preset, ReviewLog } from "../../../domain/model";
import {
  buildQueue,
  burySiblings,
  customQueue,
  doneTodayFrom,
  LEARN_AHEAD_MS,
  type QueueCounts,
} from "../../../domain/queue";
import { answer, type LeechAction, type Rating } from "../../../domain/scheduler";

export interface SessionData {
  rootDeckId: string;
  decks: Deck[];
  presets: Preset[];
  /** Every card of the studied deck and its subdecks, any state. */
  cards: Card[];
  /** Review logs since the start of the study day (for daily limits). */
  logsToday: ReviewLog[];
  cutoffHour: number;
  timeZone: string;
  /** A card to show first (the one just undone), while it is still in the queue. */
  pinnedId: string | null;
  /** Custom study: a fixed list of cards, no daily limits (null = the normal queue). */
  custom: { cardIds: string[]; answered: string[] } | null;
}

export interface UpNext {
  card: Card | null;
  counts: QueueCounts;
  /** When there is no card now but a learning card comes due later today. */
  waitUntil: number | null;
}

export interface AnswerChange {
  before: Card;
  card: Card;
  log: ReviewLog;
  buriedBefore: Card[];
  buried: Card[];
  leech: LeechAction | null;
}

export interface AnswerInput {
  cardId: string;
  rating: Rating;
  now: number;
  durationMs: number;
  logId: string;
}

function upNextCustom(data: SessionData, now: number): UpNext {
  const custom = data.custom as NonNullable<SessionData["custom"]>;
  const ids = customQueue(custom.cardIds, data.cards, new Set(custom.answered), now);
  const byId = new Map(data.cards.map((c) => [c.id, c]));
  const queue = ids.map((id) => byId.get(id) as Card);
  const counts = { new: 0, learning: 0, review: 0 };
  for (const c of queue)
    counts[c.queue === "new" ? "new" : c.queue === "review" ? "review" : "learning"] += 1;
  const pinned = queue.find((c) => c.id === data.pinnedId);
  const card = pinned ?? queue[0] ?? null;
  const later = custom.answered
    .map((id) => byId.get(id))
    .filter(
      (c): c is Card =>
        !!c && (c.queue === "learning" || c.queue === "relearning") && c.due > now + LEARN_AHEAD_MS,
    )
    .map((c) => c.due);
  return {
    card,
    counts,
    waitUntil: card === null && later.length > 0 ? Math.min(...later) - LEARN_AHEAD_MS : null,
  };
}

export function upNext(data: SessionData, now: number): UpNext {
  if (data.custom) return upNextCustom(data, now);
  const { cutoffHour, timeZone, cards } = data;
  const today = studyDay(now, cutoffHour, timeZone);
  const endOfDay = endOfStudyDay(now, cutoffHour, timeZone);
  const deckOfCard = new Map(cards.map((c) => [c.id, c.deckId]));
  const queue = buildQueue({
    rootDeckId: data.rootDeckId,
    decks: data.decks,
    presets: data.presets,
    cards,
    now,
    today,
    endOfDay,
    doneToday: doneTodayFrom(
      data.logsToday,
      deckOfCard,
      startOfStudyDay(now, cutoffHour, timeZone),
    ),
    seed: `${today}:${data.rootDeckId}`,
  });
  const pinned = queue.cards.find((c) => c.id === data.pinnedId);
  const card = pinned ?? queue.cards[0] ?? null;
  const laterDue = cards
    .filter(
      (c) =>
        c.deletedAt === null &&
        (c.queue === "learning" || c.queue === "relearning") &&
        c.due < endOfDay,
    )
    .map((c) => c.due);
  const waitUntil =
    card === null && laterDue.length > 0 ? Math.min(...laterDue) - LEARN_AHEAD_MS : null;
  return { card, counts: queue.counts, waitUntil };
}

function presetOf(data: SessionData, card: Card): Preset {
  const deck = data.decks.find((d) => d.id === card.deckId);
  const preset = data.presets.find((p) => p.id === deck?.presetId);
  if (!preset) throw new Error(`no preset for deck ${card.deckId}`);
  return preset;
}

const replaceAll = (cards: Card[], changed: readonly Card[]) => {
  const byId = new Map(changed.map((c) => [c.id, c]));
  return cards.map((c) => byId.get(c.id) ?? c);
};

export function answerCard(
  data: SessionData,
  { cardId, rating, now, durationMs, logId }: AnswerInput,
): { data: SessionData; change: AnswerChange } {
  const before = data.cards.find((c) => c.id === cardId);
  if (!before) throw new Error(`card ${cardId} is not in this session`);
  const preset = presetOf(data, before);
  const { nextCard, reviewLog, leech } = answer({
    card: before,
    rating,
    now,
    preset,
    durationMs,
    logId,
  });
  const today = studyDay(now, data.cutoffHour, data.timeZone);
  const buried = burySiblings(before, data.cards, preset, today, now);
  const buriedIds = new Set(buried.map((c) => c.id));
  const change: AnswerChange = {
    before,
    card: nextCard,
    log: reviewLog,
    buriedBefore: data.cards.filter((c) => buriedIds.has(c.id)),
    buried,
    leech,
  };
  return {
    data: {
      ...data,
      cards: replaceAll(data.cards, [nextCard, ...buried]),
      logsToday: [...data.logsToday, reviewLog],
      pinnedId: data.pinnedId === cardId ? null : data.pinnedId,
      custom: data.custom
        ? { ...data.custom, answered: [...new Set([...data.custom.answered, cardId])] }
        : null,
    },
    change,
  };
}

/** Reverts an answer: cards as they were, the log no longer counts, the card comes back first. */
export function undoAnswer(data: SessionData, change: AnswerChange, now: number): SessionData {
  return {
    ...data,
    cards: replaceAll(data.cards, [change.before, ...change.buriedBefore]),
    logsToday: data.logsToday.map((l) => (l.id === change.log.id ? { ...l, undoneAt: now } : l)),
    pinnedId: change.before.id,
    custom: data.custom
      ? { ...data.custom, answered: data.custom.answered.filter((id) => id !== change.before.id) }
      : null,
  };
}

/** Applies a manual change to one card (bury, suspend, flag — or undoing one). */
export function replaceCard(data: SessionData, card: Card): SessionData {
  return { ...data, cards: replaceAll(data.cards, [card]) };
}
