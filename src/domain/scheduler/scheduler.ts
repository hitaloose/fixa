/**
 * FSRS scheduling (docs/05-agendamento.md › Agendador). ts-fsrs is an implementation detail of
 * this module: everything in and out is a domain Card / ReviewLog with epoch-ms times.
 */
import {
  type Card as FsrsCard,
  fsrs,
  type Grade,
  type IPreview,
  type FSRS as Scheduler,
  State,
  type StepUnit,
} from "ts-fsrs";
import type { Card, CardSnapshot, FsrsState, Preset, ReviewLog } from "../model";

export type Rating = 1 | 2 | 3 | 4;
export type LeechAction = Preset["leechAction"];

/** Answer durations are capped so a card left open doesn't skew statistics. */
export const MAX_ANSWER_MS = 60_000;

export interface AnswerInput {
  card: Card;
  rating: Rating;
  now: number;
  preset: Preset;
  durationMs: number;
  /** Injected ID for the new review log (domain never generates IDs). */
  logId: string;
}

export interface AnswerResult {
  nextCard: Card;
  reviewLog: ReviewLog;
  /** Set when this lapse reached the preset's leech threshold. */
  leech: LeechAction | null;
}

export interface IntervalPreview {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

const TO_FSRS_STATE: Record<FsrsState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};
const FROM_FSRS_STATE: Record<State, FsrsState> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

function schedulerFor(preset: Preset): Scheduler {
  return fsrs({
    request_retention: preset.desiredRetention,
    maximum_interval: preset.maximumIntervalDays,
    ...(preset.fsrsWeights ? { w: preset.fsrsWeights } : {}),
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: preset.learningSteps as StepUnit[],
    relearning_steps: preset.relearningSteps as StepUnit[],
  });
}

function toFsrs(card: Card): FsrsCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningStep,
    reps: card.reps,
    lapses: card.lapses,
    state: TO_FSRS_STATE[card.state],
    ...(card.lastReviewAt === null ? {} : { last_review: new Date(card.lastReviewAt) }),
  };
}

const DAY_MS = 86_400_000;

/**
 * ts-fsrs keeps Hard < Good < Easy by adding a day even past `maximum_interval`,
 * so the preset's maximum is enforced here.
 */
function capInterval(next: FsrsCard, now: number, maximumIntervalDays: number): FsrsCard {
  if (next.scheduled_days <= maximumIntervalDays) return next;
  return {
    ...next,
    scheduled_days: maximumIntervalDays,
    due: new Date(now + maximumIntervalDays * DAY_MS),
  };
}

function fromFsrs(card: Card, next: FsrsCard, now: number): Card {
  const state = FROM_FSRS_STATE[next.state];
  return {
    ...card,
    queue: state,
    state,
    buriedUntilDay: null,
    due: next.due.getTime(),
    stability: next.stability,
    difficulty: next.difficulty,
    elapsedDays: next.elapsed_days,
    scheduledDays: next.scheduled_days,
    learningStep: next.learning_steps,
    reps: next.reps,
    lapses: next.lapses,
    lastReviewAt: now,
    updatedAt: now,
  };
}

function snapshot(card: Card): CardSnapshot {
  return {
    queue: card.queue,
    state: card.state,
    buriedUntilDay: card.buriedUntilDay,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsedDays,
    scheduledDays: card.scheduledDays,
    learningStep: card.learningStep,
    reps: card.reps,
    lapses: card.lapses,
    lastReviewAt: card.lastReviewAt,
  };
}

function assertStudyable(card: Card): void {
  if (card.queue === "suspended" || card.queue === "buried") {
    throw new Error(`cannot schedule a ${card.queue} card (${card.id})`);
  }
}

/** FSRS step without leech handling — shared by answer() and replay(). */
function scheduleNext(card: Card, rating: Rating, now: number, preset: Preset) {
  const { card: raw, log } = schedulerFor(preset).next(
    toFsrs(card),
    new Date(now),
    rating as Grade,
  );
  return { scheduled: fromFsrs(card, capInterval(raw, now, preset.maximumIntervalDays), now), log };
}

/** Pure: schedules one answer and returns the next card state plus its review log. */
export function answer({
  card,
  rating,
  now,
  preset,
  durationMs,
  logId,
}: AnswerInput): AnswerResult {
  assertStudyable(card);
  const { scheduled, log } = scheduleNext(card, rating, now, preset);

  const lapsed = scheduled.lapses > card.lapses;
  const leech = lapsed && scheduled.lapses >= preset.leechThreshold ? preset.leechAction : null;
  const nextCard: Card = leech === "suspend" ? { ...scheduled, queue: "suspended" } : scheduled;

  const reviewLog: ReviewLog = {
    id: logId,
    cardId: card.id,
    reviewedAt: now,
    rating,
    stateBefore: card.state,
    cardBefore: snapshot(card),
    scheduledDays: nextCard.scheduledDays,
    elapsedDays: log.elapsed_days,
    durationMs: Math.min(Math.max(durationMs, 0), MAX_ANSWER_MS),
    kind: "review",
    undoneAt: null,
  };
  return { nextCard, reviewLog, leech };
}

/** Milliseconds until the card would be due for each rating — labels for the answer buttons. */
export function previewIntervals(card: Card, now: number, preset: Preset): IntervalPreview {
  assertStudyable(card);
  const preview: IPreview = schedulerFor(preset).repeat(toFsrs(card), new Date(now));
  const until = (g: Grade) =>
    capInterval(preview[g].card, now, preset.maximumIntervalDays).due.getTime() - now;
  return { again: until(1), hard: until(2), good: until(3), easy: until(4) };
}

/** A card that has never been studied. New cards are ordered by newPosition, not due. */
function asNew(card: Card): Card {
  return {
    ...card,
    queue: "new",
    state: "new",
    buriedUntilDay: null,
    due: card.createdAt,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    learningStep: 0,
    reps: 0,
    lapses: 0,
    lastReviewAt: null,
  };
}

/**
 * Rebuilds a card's scheduling state from its review logs (backup merge). Starts from a new
 * card and applies non-undone logs in review order: "review" answers, "reset" starts over.
 * Changes only scheduling fields; a suspended/buried card stays parked with the replayed state.
 */
export function replay(card: Card, logs: ReviewLog[], preset: Preset): Card {
  const history = logs
    .filter((l) => l.undoneAt === null)
    .sort((a, b) => a.reviewedAt - b.reviewedAt);
  let current = asNew(card);
  for (const log of history) {
    if (log.kind === "reset") current = asNew(card);
    else if (log.kind === "review") {
      current = scheduleNext(current, log.rating as Rating, log.reviewedAt, preset).scheduled;
    } else throw new Error(`replay does not support "${log.kind}" logs yet`);
  }
  const parked = card.queue === "suspended" || card.queue === "buried";
  return {
    ...current,
    queue: parked ? card.queue : current.state,
    buriedUntilDay: card.buriedUntilDay,
    updatedAt: card.updatedAt,
  };
}
