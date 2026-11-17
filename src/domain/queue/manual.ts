/** Manual card actions (docs/05-agendamento.md › Ações manuais). The FSRS state is never touched. */
import { addDays } from "../day";
import type { Card } from "../model";

/** Hidden until the next study day. */
export function buryCard(card: Card, today: string, now: number): Card {
  return { ...card, queue: "buried", buriedUntilDay: addDays(today, 1), updatedAt: now };
}

export function suspendCard(card: Card, now: number): Card {
  return { ...card, queue: "suspended", buriedUntilDay: null, updatedAt: now };
}

/** Back to the queue its FSRS state implies. */
export function unsuspendCard(card: Card, now: number): Card {
  if (card.queue !== "suspended") return card;
  return { ...card, queue: card.state, updatedAt: now };
}

/** 0 clears the flag; 1–7 are the colours. */
export function setFlag(card: Card, flag: number, now: number): Card {
  return { ...card, flag, updatedAt: now };
}
