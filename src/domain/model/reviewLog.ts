import { z } from "zod";
import { epochMs, idSchema } from "./base";
import { fsrsStateSchema, schedulingShape } from "./card";

export const cardSnapshotSchema = z.object(schedulingShape);

/** Append-only. "Undo" sets undoneAt; it never deletes. */
export const reviewLogSchema = z
  .object({
    id: idSchema,
    cardId: idSchema,
    reviewedAt: epochMs,
    /** 1–4 for answers; 0 for reschedule/reset/manual, which are not answers. */
    rating: z.number().int().min(0).max(4),
    stateBefore: fsrsStateSchema,
    cardBefore: cardSnapshotSchema,
    scheduledDays: z.number().int().nonnegative(),
    elapsedDays: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    kind: z.enum(["review", "manual", "reschedule", "reset"]),
    undoneAt: epochMs.nullable(),
  })
  .refine((log) => (log.kind === "review") === log.rating >= 1, {
    message: "only review logs have a rating (1–4); other kinds use 0",
    path: ["rating"],
  });

export type ReviewLog = z.output<typeof reviewLogSchema>;
export type CardSnapshot = z.output<typeof cardSnapshotSchema>;

export const parseReviewLog = (input: unknown): ReviewLog => reviewLogSchema.parse(input);
