import type { ReviewLog } from "../model";
import type { DoneToday } from "./queue";

/**
 * What was already studied today, per deck: new cards introduced and reviews answered
 * (learning steps don't count against limits). `deckOfCard` maps card id → deck id.
 */
export function doneTodayFrom(
  logs: readonly ReviewLog[],
  deckOfCard: ReadonlyMap<string, string>,
  startOfToday: number,
): DoneToday {
  const done: DoneToday = {};
  for (const log of logs) {
    const deckId = deckOfCard.get(log.cardId);
    const counts = log.stateBefore === "new" || log.stateBefore === "review";
    if (
      !deckId ||
      !counts ||
      log.kind !== "review" ||
      log.undoneAt !== null ||
      log.reviewedAt < startOfToday
    ) {
      continue;
    }
    const entry = (done[deckId] ??= { newIntroduced: 0, reviewsDone: 0 });
    if (log.stateBefore === "new") entry.newIntroduced += 1;
    else entry.reviewsDone += 1;
  }
  return done;
}
