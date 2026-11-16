import { z } from "zod";
import { dayString, entity, idSchema } from "./base";

const limit = z.number().int().nonnegative();

export const deckNameSchema = z
  .string()
  .refine((n) => n.trim().length > 0, "deck name must not be blank")
  .refine((n) => !n.includes("::"), "store the node name only; hierarchy lives in parentId");

export const deckOverridesSchema = z.object({
  newPerDay: limit.optional(),
  reviewsPerDay: limit.optional(),
  todayOnly: z
    .object({ day: dayString, newPerDay: limit.optional(), reviewsPerDay: limit.optional() })
    .optional(),
});

export const deckSchema = entity({
  name: deckNameSchema,
  parentId: idSchema.nullable(),
  presetId: idSchema,
  description: z.string(),
  collapsed: z.boolean(),
  overrides: deckOverridesSchema,
  position: z.number().int().nonnegative(),
});

export type Deck = z.output<typeof deckSchema>;
export type DeckOverrides = z.output<typeof deckOverridesSchema>;
