import { v1 } from "./v1";

/**
 * Schema v2: notes indexed by Anki guid (re-import without duplicates). Only an index is added,
 * so no upgrade() is needed. NEVER edit after it is published — add v3.ts instead.
 */
export const v2 = {
  ...v1,
  notes: `${v1.notes}, guid`,
} as const;
