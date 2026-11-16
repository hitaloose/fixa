import { z } from "zod";
import { entity } from "./base";

export const noteFieldSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sticky: z.boolean(),
  rtl: z.boolean(),
});

export const cardTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  front: z.string(),
  back: z.string(),
});

export const noteTypeSchema = entity({
  name: z.string().min(1),
  kind: z.enum(["standard", "cloze"]),
  fields: z
    .array(noteFieldSchema)
    .min(1)
    .refine(
      (fs) => new Set(fs.map((f) => f.name)).size === fs.length,
      "field names must be unique",
    ),
  templates: z.array(cardTemplateSchema).min(1),
  css: z.string(),
}).refine((nt) => nt.kind !== "cloze" || nt.templates.length === 1, {
  message: "a cloze note type has exactly one template",
  path: ["templates"],
});

export type NoteType = z.output<typeof noteTypeSchema>;
export type NoteField = z.output<typeof noteFieldSchema>;
export type CardTemplate = z.output<typeof cardTemplateSchema>;

export const parseNoteType = (input: unknown): NoteType => noteTypeSchema.parse(input);
