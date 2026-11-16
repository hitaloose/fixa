import { z } from "zod";

/** Keyed by the SHA-256 of its content — natural dedupe. */
export const mediaSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/),
  fileName: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().nonnegative(),
  blob: z.instanceof(Blob),
});

export type Media = z.output<typeof mediaSchema>;
