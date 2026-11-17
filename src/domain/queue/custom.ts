/**
 * Custom study (docs/01 › Estudo personalizado): a temporary session over chosen cards, without
 * daily limits. Answers are scheduled normally; nothing like Anki's filtered decks is created.
 */
import type { Card, Note, ReviewLog } from "../model";
import { LEARN_AHEAD_MS } from "./queue";

const studyable = (c: Card | undefined): c is Card =>
  c !== undefined && c.deletedAt === null && c.queue !== "suspended" && c.queue !== "buried";

/** Cards answered "Again" since the start of today, in the order they were last forgotten. */
export function forgottenToday(
  cards: readonly Card[],
  logs: readonly ReviewLog[],
  startOfToday: number,
): string[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const lastForgotten = new Map<string, number>();
  for (const log of logs) {
    if (
      log.kind !== "review" ||
      log.undoneAt !== null ||
      log.rating !== 1 ||
      log.reviewedAt < startOfToday
    )
      continue;
    lastForgotten.set(log.cardId, Math.max(lastForgotten.get(log.cardId) ?? 0, log.reviewedAt));
  }
  return [...lastForgotten.entries()]
    .filter(([id]) => studyable(byId.get(id)))
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
}

/** Cards whose note has the tag or a child tag: scheduled ones by due date, then new ones. */
export function studyByTag(cards: readonly Card[], notes: readonly Note[], tag: string): string[] {
  const wanted = tag.trim().toLocaleLowerCase("pt-BR");
  const tagged = new Set(
    notes
      .filter((n) => n.tags.some((t) => t === wanted || t.startsWith(`${wanted}::`)))
      .map((n) => n.id),
  );
  const chosen = cards.filter((c) => studyable(c) && tagged.has(c.noteId));
  const scheduled = chosen.filter((c) => c.state !== "new").sort((a, b) => a.due - b.due);
  const fresh = chosen
    .filter((c) => c.state === "new")
    .sort((a, b) => a.newPosition - b.newPosition);
  return [...scheduled, ...fresh].map((c) => c.id);
}

/** Reviews due in the `days` days after today (today's are already in the normal queue). */
export function reviewAhead(cards: readonly Card[], endOfToday: number, days: number): string[] {
  const until = endOfToday + days * 86_400_000;
  return cards
    .filter((c) => studyable(c) && c.queue === "review" && c.due >= endOfToday && c.due < until)
    .sort((a, b) => a.due - b.due)
    .map((c) => c.id);
}

/**
 * What a custom session shows next: chosen cards not answered yet (in order), then answered
 * ones that are relearning and come due within the learn-ahead window.
 */
export function customQueue(
  chosen: readonly string[],
  cards: readonly Card[],
  answered: ReadonlySet<string>,
  now: number,
): string[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const pending = chosen.filter((id) => !answered.has(id) && studyable(byId.get(id)));
  const again = chosen
    .filter((id) => answered.has(id))
    .map((id) => byId.get(id))
    .filter(
      (c): c is Card =>
        studyable(c) &&
        (c.queue === "learning" || c.queue === "relearning") &&
        c.due <= now + LEARN_AHEAD_MS,
    )
    .sort((a, b) => a.due - b.due)
    .map((c) => c.id);
  return [...pending, ...again];
}
