import { describe, expect, it } from "vitest";
import { FACTORY_NOW, makeCard } from "../../../tests/factories";
import { buryCard, setFlag, suspendCard, unsuspendCard } from "./index";

const NOW = FACTORY_NOW + 1_000;

describe("manual card actions", () => {
  it("buries a card until tomorrow, keeping its FSRS state", () => {
    const card = makeCard({ queue: "review", state: "review", due: NOW, reps: 2 });
    expect(buryCard(card, "2026-11-16", NOW)).toEqual({
      ...card,
      queue: "buried",
      buriedUntilDay: "2026-11-17",
      updatedAt: NOW,
    });
  });

  it("suspends and unsuspends, returning to the FSRS state", () => {
    const card = makeCard({ queue: "learning", state: "learning", reps: 1 });
    const suspended = suspendCard(card, NOW);
    expect(suspended).toEqual({ ...card, queue: "suspended", updatedAt: NOW });
    expect(unsuspendCard(suspended, NOW + 1)).toEqual({
      ...card,
      queue: "learning",
      updatedAt: NOW + 1,
    });
  });

  it("unsuspending a card that is not suspended changes nothing", () => {
    const card = makeCard();
    expect(unsuspendCard(card, NOW)).toBe(card);
  });

  it("clears a burial when suspending", () => {
    const buried = buryCard(makeCard(), "2026-11-16", NOW);
    expect(suspendCard(buried, NOW)).toMatchObject({ queue: "suspended", buriedUntilDay: null });
  });

  it("sets and clears the flag", () => {
    const card = makeCard();
    expect(setFlag(card, 3, NOW)).toEqual({ ...card, flag: 3, updatedAt: NOW });
    expect(setFlag(setFlag(card, 3, NOW), 0, NOW).flag).toBe(0);
  });
});
