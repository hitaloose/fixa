import { parseCard } from "../../domain/model";
import type { Clock, IdGenerator } from "../../domain/ports";
import type { FixaDb } from "../db";
import { createEntityRepository } from "./entityRepository";

export function createCardsRepository({
  db,
  clock,
  ids,
}: {
  db: FixaDb;
  clock: Clock;
  ids: IdGenerator;
}) {
  const base = createEntityRepository({ table: db.cards, parse: parseCard, clock, ids });
  return {
    ...base,

    /** Cards that may be studied today: new, buried (may be released) and scheduled before `endOfDay`. */
    studyCandidates: (endOfDay: number) =>
      db.cards
        .where("queue")
        .anyOf(["new", "buried", "learning", "review", "relearning"])
        .filter(
          (c) =>
            c.deletedAt === null && (c.queue === "new" || c.queue === "buried" || c.due < endOfDay),
        )
        .toArray(),

    inDecks: (deckIds: readonly string[]) =>
      db.cards
        .where("deckId")
        .anyOf([...deckIds])
        .filter((c) => c.deletedAt === null)
        .toArray(),
  };
}
