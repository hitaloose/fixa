/**
 * Clock implementations. Structurally compatible with `Clock` in src/domain/ports.ts
 * (lib imports nothing from the project — see docs/03-arquitetura.md).
 */
export interface SystemClock {
  now(): number;
}

export interface FixedClock extends SystemClock {
  advance(ms: number): void;
  set(instant: number): void;
}

export const systemClock: SystemClock = { now: () => Date.now() };

export function fixedClock(start: number): FixedClock {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
    set: (instant) => {
      current = instant;
    },
  };
}
