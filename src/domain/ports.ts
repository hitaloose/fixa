/** Injected side effects. Domain code never reads the real clock or generates IDs itself. */
export interface Clock {
  /** Current instant in epoch milliseconds. */
  now(): number;
}

export interface IdGenerator {
  /** A new unique, time-ordered ID (UUIDv7 in production). */
  next(): string;
}
