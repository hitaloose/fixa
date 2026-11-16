import { z } from "zod";
import { dayString, entity, epochMs, idSchema } from "./base";

export const queueSchema = z.enum([
  "new",
  "learning",
  "review",
  "relearning",
  "suspended",
  "buried",
]);
export const fsrsStateSchema = z.enum(["new", "learning", "review", "relearning"]);

/** Scheduling fields — what a ReviewLog snapshots so "undo" can restore a card exactly. */
export const schedulingShape = {
  queue: queueSchema,
  /** FSRS state, kept intact while the card is suspended or buried. */
  state: fsrsStateSchema,
  buriedUntilDay: dayString.nullable(),
  due: epochMs,
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsedDays: z.number().int().nonnegative(),
  scheduledDays: z.number().int().nonnegative(),
  learningStep: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  lastReviewAt: epochMs.nullable(),
};

export const cardSchema = entity({
  noteId: idSchema,
  deckId: idSchema,
  templateOrd: z.number().int().nonnegative(),
  newPosition: z.number().int().nonnegative(),
  flag: z.number().int().min(0).max(7),
  ...schedulingShape,
})
  .refine((c) => (c.queue === "buried") === (c.buriedUntilDay !== null), {
    message: "buriedUntilDay is set exactly when the card is buried",
    path: ["buriedUntilDay"],
  })
  .refine((c) => c.queue === "suspended" || c.queue === "buried" || c.queue === c.state, {
    message: "queue must equal the FSRS state unless suspended or buried",
    path: ["queue"],
  });

export type Card = z.output<typeof cardSchema>;
export type Queue = z.output<typeof queueSchema>;
export type FsrsState = z.output<typeof fsrsStateSchema>;

export const parseCard = (input: unknown): Card => cardSchema.parse(input);
