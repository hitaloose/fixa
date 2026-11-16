import { v7 as uuidv7 } from "uuid";

/** Structurally compatible with `IdGenerator` in src/domain/ports.ts. */
export interface Ids {
  next(): string;
}

export const uuidv7Generator: Ids = { next: () => uuidv7() };

/** Deterministic, ordered, valid UUIDv7 IDs for tests. */
export function sequentialIds(): Ids {
  let n = 0;
  return {
    next: () => {
      n += 1;
      return `00000000-0000-7000-8000-${n.toString(16).padStart(12, "0")}`;
    },
  };
}
