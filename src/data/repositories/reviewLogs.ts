import type { EntityTable } from "dexie";
import { type ReviewLog, reviewLogSchema } from "../../domain/model";
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
      await table.add(reviewLogSchema.parse(log));
    },

    byCard: (cardId: string): Promise<ReviewLog[]> =>
      table.where("[cardId+reviewedAt]").between([cardId, -Infinity], [cardId, Infinity]).toArray(),

    async markUndone(id: string): Promise<void> {
      const updated = await table.update(id, { undoneAt: clock.now() });
      if (updated === 0) throw new Error(`reviewLog ${id} not found`);
    },
  };
}
