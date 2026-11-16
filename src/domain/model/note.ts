import { z } from "zod";
import { entity, idSchema } from "./base";

/** Lowercase, no whitespace; hierarchy with "::". */
export const tagSchema = z
  .string()
  .min(1)
  .refine((t) => !/\s/.test(t), "tags must not contain whitespace")
  .refine((t) => t === t.toLocaleLowerCase("pt-BR"), "tags must be lowercase");

export const noteSchema = entity({
  noteTypeId: idSchema,
  fields: z.record(z.string(), z.string()),
  tags: z.array(tagSchema),
  sortField: z.string(),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
});

export type Note = z.output<typeof noteSchema>;
