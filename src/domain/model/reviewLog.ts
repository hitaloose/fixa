import { z } from "zod";
import { epochMs, idSchema } from "./base";
import { fsrsStateSchema, schedulingShape } from "./card";

export const cardSnapshotSchema = z.object(schedulingShape);

/** Append-only. "Undo" sets undoneAt; it never deletes. */
export const reviewLogSchema = z.object({
  id: idSchema,
  cardId: idSchema,
  reviewedAt: epochMs,
  rating: z.number().int().min(1).max(4),
  stateBefore: fsrsStateSchema,
  cardBefore: cardSnapshotSchema,
  scheduledDays: z.number().int().nonnegative(),
  elapsedDays: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  kind: z.enum(["review", "manual", "reschedule", "reset"]),
  undoneAt: epochMs.nullable(),
});

export type ReviewLog = z.output<typeof reviewLogSchema>;
export type CardSnapshot = z.output<typeof cardSnapshotSchema>;
