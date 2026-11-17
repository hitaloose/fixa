/**
 * Daily limits on the options screen: each limit applies at one scope — the preset, this deck
 * only, or today only (docs/05-agendamento.md › Limites efetivos).
 */
import type { Deck, DeckOverrides, Preset } from "../../../domain/model";

export type LimitField = "newPerDay" | "reviewsPerDay";
export type LimitScope = "preset" | "deck" | "today";

export interface LimitDraft {
  scope: LimitScope;
  /** This deck's own limit (shown when the scope is "deck"). */
  deck: number;
  /** Today's limit (shown when the scope is "today"). */
  today: number;
}

export const LIMIT_FIELDS: readonly LimitField[] = ["newPerDay", "reviewsPerDay"];

/** The scope currently in effect for one limit, and the values to show for each scope. */
export function limitDraft(
  deck: Deck,
  preset: Preset,
  field: LimitField,
  today: string,
): LimitDraft {
  const { overrides } = deck;
  const todays = overrides.todayOnly?.day === today ? overrides.todayOnly[field] : undefined;
  const own = overrides[field];
  return {
    scope: todays !== undefined ? "today" : own !== undefined ? "deck" : "preset",
    deck: own ?? preset[field],
    today: todays ?? own ?? preset[field],
  };
}

/** The deck overrides that make each limit apply at its chosen scope. */
export function overridesFrom(
  current: DeckOverrides,
  limits: Record<LimitField, LimitDraft>,
  today: string,
): DeckOverrides {
  const next: DeckOverrides = {};
  const todayOnly: NonNullable<DeckOverrides["todayOnly"]> = { day: today };
  let anyToday = false;
  for (const field of LIMIT_FIELDS) {
    const { scope, deck, today: todays } = limits[field];
    if (scope === "deck") next[field] = deck;
    if (scope === "today") {
      const own = current[field];
      if (own !== undefined) next[field] = own;
      todayOnly[field] = todays;
      anyToday = true;
    }
  }
  if (anyToday) next.todayOnly = todayOnly;
  return next;
}
