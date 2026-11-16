import { z } from "zod";

export const idSchema = z.uuid();
export const epochMs = z.number().int().nonnegative();
export const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const baseShape = {
  id: idSchema,
  createdAt: epochMs,
  updatedAt: epochMs,
  deletedAt: epochMs.nullable(),
};

/** User entity: common fields + invariant `updatedAt >= createdAt`. */
export function entity<S extends z.ZodRawShape>(shape: S) {
  // The generic object output can't be narrowed by TS, but baseShape guarantees these keys.
  return z.object({ ...baseShape, ...shape }).refine((e) => timestampsOrdered(e as Timestamps), {
    message: "updatedAt must not be earlier than createdAt",
    path: ["updatedAt"],
  });
}

type Timestamps = { createdAt: number; updatedAt: number };
const timestampsOrdered = (e: Timestamps) => e.updatedAt >= e.createdAt;

export type BaseEntity = {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};
