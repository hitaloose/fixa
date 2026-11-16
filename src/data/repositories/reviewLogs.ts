import type { EntityTable } from "dexie";
import { parseReviewLog, type ReviewLog } from "../../domain/model";
import type { Clock } from "../../domain/ports";

/** Append-only: logs are never overwritten or deleted; "undo" only marks undoneAt. */
export function createReviewLogsRepository({
  table,
  clock,
}: {
  table: EntityTable<ReviewLog, "id">;
  clock: Clock;
}) {
  return {
    async append(log: ReviewLog): Promise<void> {
      await table.add(parseReviewLog(log));
    },

    byCard: (cardId: string): Promise<ReviewLog[]> =>
      table.where("[cardId+reviewedAt]").between([cardId, -Infinity], [cardId, Infinity]).toArray(),

    since: (instant: number): Promise<ReviewLog[]> =>
      table.where("reviewedAt").aboveOrEqual(instant).toArray(),

    /** Latest logs first, up to `limit` (e.g. for the average answer time). */
    recent: (limit: number): Promise<ReviewLog[]> =>
      table.orderBy("reviewedAt").reverse().limit(limit).toArray(),

    async markUndone(id: string): Promise<void> {
      const updated = await table.update(id, { undoneAt: clock.now() });
      if (updated === 0) throw new Error(`reviewLog ${id} not found`);
    },
  };
}
