/**
 * Study queue (docs/05-agendamento.md › Montagem da fila). Pure: the caller loads candidate
 * cards, decks, presets and today's counts; this decides what is studied and in which order.
 */
import { addDays } from "../day";
import type { Card, Deck, Preset, Queue } from "../model";
import { seededShuffle } from "./random";

/** Learning cards due within this window are shown now instead of waiting. */
export const LEARN_AHEAD_MS = 20 * 60_000;

/** Cards introduced / reviews done today, per deck (not including subdecks). */
export type DoneToday = Record<string, { newIntroduced: number; reviewsDone: number }>;

export interface QueueInput {
  /** The deck being studied; its subdecks are included. */
  rootDeckId: string;
  decks: Deck[];
  presets: Preset[];
  /** Candidate cards (any state); filtering happens here. */
  cards: Card[];
  now: number;
  /** studyDay(now) */
  today: string;
  /** endOfStudyDay(now) — exclusive. */
  endOfDay: number;
  doneToday: DoneToday;
  /** Seed for "random" orders (e.g. today + deck id), so the order is stable within a day. */
  seed: string;
}

export interface QueueCounts {
  new: number;
  learning: number;
  review: number;
}

export interface StudyQueue {
  /** In study order: due learning first, then reviews with new cards spread between them. */
  cards: Card[];
  /** What will be studied today (limits applied), as shown on the deck list. */
  counts: QueueCounts;
}

interface Limits {
  newPerDay: number;
  reviewsPerDay: number;
}

/** Today-only override > per-deck override > preset, field by field. */
export function effectiveLimits(deck: Deck, preset: Preset, today: string): Limits {
  const { overrides } = deck;
  const todayOnly = overrides.todayOnly?.day === today ? overrides.todayOnly : undefined;
  return {
    newPerDay: todayOnly?.newPerDay ?? overrides.newPerDay ?? preset.newPerDay,
    reviewsPerDay: todayOnly?.reviewsPerDay ?? overrides.reviewsPerDay ?? preset.reviewsPerDay,
  };
}

/** Burials expire on their day (buriedUntilDay is set exactly when the card is buried). */
function burialExpired(card: Card, today: string): boolean {
  return card.buriedUntilDay !== null && card.buriedUntilDay <= today;
}

/** Queue a card is effectively in today. */
function queueToday(card: Card, today: string): Queue {
  return burialExpired(card, today) ? card.state : card.queue;
}

class DeckTree {
  private readonly byId = new Map<string, Deck>();
  private readonly children = new Map<string, Deck[]>();

  constructor(
    decks: Deck[],
    private readonly rootId: string,
  ) {
    for (const d of decks) {
      this.byId.set(d.id, d);
      if (d.parentId !== null)
        this.children.set(d.parentId, [...(this.children.get(d.parentId) ?? []), d]);
    }
  }

  get(id: string): Deck {
    const deck = this.byId.get(id);
    if (!deck) throw new Error(`deck ${id} not found`);
    return deck;
  }

  subtree(id: string): string[] {
    return [id, ...(this.children.get(id) ?? []).flatMap((c) => this.subtree(c.id))];
  }

  /** The deck and its ancestors up to (and including) the studied root. */
  chain(id: string): string[] {
    const ids = [id];
    let current = this.get(id);
    while (current.id !== this.rootId) {
      current = this.get(current.parentId ?? "");
      ids.push(current.id);
    }
    return ids;
  }

  /** Names from the studied root down, for "deck" review order. */
  path(id: string): string {
    return this.chain(id)
      .map((d) => this.get(d).name)
      .reverse()
      .join("::");
  }
}

/** One new card after every reviews/news reviews; leftovers go last. */
function interleave(reviews: Card[], news: Card[]): Card[] {
  const out: Card[] = [];
  const every = reviews.length / news.length;
  let n = 0;
  reviews.forEach((review, i) => {
    out.push(review);
    while (i + 1 >= every * (n + 1)) out.push(news[n++] as Card);
  });
  return [...out, ...news.slice(n)];
}

const byDueThenId = (a: Card, b: Card) => a.due - b.due || a.id.localeCompare(b.id);
const byPositionThenId = (a: Card, b: Card) =>
  a.newPosition - b.newPosition || a.id.localeCompare(b.id);

export function buildQueue(input: QueueInput): StudyQueue {
  const { rootDeckId, decks, presets, now, today, endOfDay, doneToday, seed } = input;
  const tree = new DeckTree(decks, rootDeckId);
  const presetById = new Map(presets.map((p) => [p.id, p]));
  const presetOf = (deck: Deck): Preset => {
    const preset = presetById.get(deck.presetId);
    if (!preset) throw new Error(`preset ${deck.presetId} not found`);
    return preset;
  };

  const inScope = new Set(tree.subtree(rootDeckId));
  const left = new Map<string, Limits>();
  for (const id of inScope) {
    const deck = tree.get(id);
    const limits = effectiveLimits(deck, presetOf(deck), today);
    const done = tree.subtree(id).reduce(
      (acc, d) => ({
        newPerDay: acc.newPerDay + (doneToday[d]?.newIntroduced ?? 0),
        reviewsPerDay: acc.reviewsPerDay + (doneToday[d]?.reviewsDone ?? 0),
      }),
      { newPerDay: 0, reviewsPerDay: 0 },
    );
    left.set(id, {
      newPerDay: Math.max(0, limits.newPerDay - done.newPerDay),
      reviewsPerDay: Math.max(0, limits.reviewsPerDay - done.reviewsPerDay),
    });
  }

  const active = input.cards.filter((c) => c.deletedAt === null && inScope.has(c.deckId));
  const withQueue = (q: Queue[]) => active.filter((c) => q.includes(queueToday(c, today)));

  const learningToday = withQueue(["learning", "relearning"]).filter((c) => c.due < endOfDay);
  const learningNow = learningToday.filter((c) => c.due <= now + LEARN_AHEAD_MS).sort(byDueThenId);

  const order = presetOf(tree.get(rootDeckId));
  const dueReviews = withQueue(["review"])
    .filter((c) => c.due < endOfDay)
    .sort(byDueThenId);
  const reviewCandidates =
    order.reviewOrder === "random"
      ? seededShuffle(dueReviews, `${seed}:review`)
      : order.reviewOrder === "deck"
        ? [...dueReviews].sort(
            (a, b) => tree.path(a.deckId).localeCompare(tree.path(b.deckId)) || byDueThenId(a, b),
          )
        : dueReviews;
  const newSorted = withQueue(["new"]).sort(byPositionThenId);
  const newCandidates =
    order.newCardOrder === "random" ? seededShuffle(newSorted, `${seed}:new`) : newSorted;

  const take = (cards: Card[], ...kinds: (keyof Limits)[]) =>
    cards.filter((card) => {
      const chain = tree.chain(card.deckId).map((id) => left.get(id) as Limits);
      if (!chain.every((l) => kinds.every((k) => l[k] > 0))) return false;
      for (const l of chain) for (const k of kinds) l[k] -= 1;
      return true;
    });

  const reviews = take(reviewCandidates, "reviewsPerDay");
  // New cards also use up the review allowance (Anki v3: the review limit caps new cards too).
  const news = take(newCandidates, "newPerDay", "reviewsPerDay");

  return {
    cards: [...learningNow, ...interleave(reviews, news)],
    counts: { new: news.length, learning: learningToday.length, review: reviews.length },
  };
}

/** Siblings of the answered card to bury until the next study day (preset decides which). */
export function burySiblings(
  answered: Card,
  cards: Card[],
  preset: Preset,
  today: string,
  now: number,
): Card[] {
  const tomorrow = addDays(today, 1);
  return cards
    .filter(
      (c) =>
        c.noteId === answered.noteId &&
        c.id !== answered.id &&
        c.deletedAt === null &&
        ((c.queue === "new" && preset.buryNewSiblings) ||
          (c.queue === "review" && preset.buryReviewSiblings)),
    )
    .map((c) => ({ ...c, queue: "buried" as const, buriedUntilDay: tomorrow, updatedAt: now }));
}

/** Cards whose burial has expired, returned to their FSRS queue (to persist). */
export function releaseBuried(cards: Card[], today: string, now: number): Card[] {
  return cards
    .filter((c) => burialExpired(c, today))
    .map((c) => ({ ...c, queue: c.state, buriedUntilDay: null, updatedAt: now }));
}
