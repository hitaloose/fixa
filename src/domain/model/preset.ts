import { z } from "zod";
import { entity } from "./base";

/** "1m", "10m", "1h", "1d" — positive integer + unit (m/h/d: the units ts-fsrs supports). */
export const stepSchema = z.string().regex(/^[1-9]\d*[mhd]$/, "expected a step like 10m");
const count = z.number().int().nonnegative();

export const presetSchema = entity({
  name: z.string().min(1).default("Padrão"),
  newPerDay: count.default(20),
  reviewsPerDay: count.default(200),
  learningSteps: z.array(stepSchema).default(["1m", "10m"]),
  relearningSteps: z.array(stepSchema).default(["10m"]),
  graduatingIntervalDays: z.number().int().positive().default(1),
  easyIntervalDays: z.number().int().positive().default(4),
  newCardOrder: z.enum(["sequential", "random"]).default("sequential"),
  reviewOrder: z.enum(["due", "random", "deck"]).default("due"),
  leechThreshold: z.number().int().positive().default(8),
  leechAction: z.enum(["tag", "suspend"]).default("tag"),
  desiredRetention: z.number().min(0.7).max(0.99).default(0.9),
  fsrsWeights: z.array(z.number()).nullable().default(null),
  maximumIntervalDays: z.number().int().positive().default(36500),
  buryNewSiblings: z.boolean().default(true),
  buryReviewSiblings: z.boolean().default(false),
  showTimer: z.boolean().default(false),
  autoplayAudio: z.boolean().default(true),
});

export type Preset = z.output<typeof presetSchema>;

export type PresetInput = z.input<typeof presetSchema>;
export const parsePreset = (input: unknown): Preset => presetSchema.parse(input);

/** The tunable part of a preset (what "restore defaults" resets and a clone copies). */
export type PresetValues = Omit<Preset, "id" | "createdAt" | "updatedAt" | "deletedAt" | "name">;

const PLACEHOLDER_ID = "00000000-0000-7000-8000-000000000000";

export function defaultPresetValues(): PresetValues {
  const { id, createdAt, updatedAt, deletedAt, name, ...values } = presetSchema.parse({
    id: PLACEHOLDER_ID,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  });
  return values;
}

/** "1m 10m" (spaces or commas) → ["1m", "10m"]; null when any step is invalid. */
export function parseSteps(text: string): string[] | null {
  const steps = text.split(/[\s,]+/).filter((s) => s !== "");
  return steps.every((s) => stepSchema.safeParse(s).success) ? steps : null;
}
