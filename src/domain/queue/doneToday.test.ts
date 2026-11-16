import { describe, expect, it } from "vitest";
import { FACTORY_NOW, makeReviewLog } from "../../../tests/factories";
import { doneTodayFrom } from "./index";

const SINCE = FACTORY_NOW;
const DECK_A = "00000000-0000-7000-b000-00000000000a";
const DECK_B = "00000000-0000-7000-b000-00000000000b";
const CARD_A = "00000000-0000-7000-b000-0000000000a1";
const CARD_B = "00000000-0000-7000-b000-0000000000b1";
const deckOf = new Map([
  [CARD_A, DECK_A],
  [CARD_B, DECK_B],
]);

describe("doneTodayFrom", () => {
  it("counts new cards introduced and reviews done today, per card deck", () => {
    const logs = [
      makeReviewLog({ cardId: CARD_A, stateBefore: "new", reviewedAt: SINCE }),
      makeReviewLog({ cardId: CARD_A, stateBefore: "review", reviewedAt: SINCE + 1 }),
      makeReviewLog({ cardId: CARD_B, stateBefore: "review", reviewedAt: SINCE + 2 }),
    ];
    expect(doneTodayFrom(logs, deckOf, SINCE)).toEqual({
      [DECK_A]: { newIntroduced: 1, reviewsDone: 1 },
      [DECK_B]: { newIntroduced: 0, reviewsDone: 1 },
    });
  });

  it("ignores logs before today, undone logs, non-review kinds and learning steps", () => {
    const logs = [
      makeReviewLog({ cardId: CARD_A, stateBefore: "new", reviewedAt: SINCE - 1 }),
      makeReviewLog({ cardId: CARD_A, stateBefore: "new", reviewedAt: SINCE, undoneAt: SINCE + 5 }),
      makeReviewLog({
        cardId: CARD_A,
        stateBefore: "review",
        reviewedAt: SINCE,
        kind: "reschedule",
      }),
      makeReviewLog({ cardId: CARD_A, stateBefore: "learning", reviewedAt: SINCE }),
      makeReviewLog({ cardId: CARD_A, stateBefore: "relearning", reviewedAt: SINCE }),
    ];
    expect(doneTodayFrom(logs, deckOf, SINCE)).toEqual({});
  });

  it("ignores logs of cards no longer known (deleted)", () => {
    const logs = [makeReviewLog({ stateBefore: "review", reviewedAt: SINCE })];
    expect(doneTodayFrom(logs, deckOf, SINCE)).toEqual({});
  });
});
