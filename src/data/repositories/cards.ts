import { type Card, parseCard, parseReviewLog, type ReviewLog } from "../../domain/model";
import type { Clock, IdGenerator } from "../../domain/ports";
import { releaseBuried } from "../../domain/queue";
import type { FixaDb } from "../db";
import { createEntityRepository } from "./entityRepository";

const LEECH_TAG = "leech";

export interface AnswerWrite {
  card: Card;
  log: ReviewLog;
  buried: Card[];
  /** Add the "leech" tag to the card's note. */
  tagLeech: boolean;
}

export interface UndoWrite {
  before: Card;
  buriedBefore: Card[];
  logId: string;
  /** Remove the "leech" tag that the answer added. */
  untagLeech: boolean;
}

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

  async function setLeechTag(noteId: string, tagged: boolean, now: number) {
    const note = await db.notes.get(noteId);
    if (!note || note.tags.includes(LEECH_TAG) === tagged) return;
    const tags = tagged ? [...note.tags, LEECH_TAG] : note.tags.filter((t) => t !== LEECH_TAG);
    await db.notes.put({ ...note, tags, updatedAt: now });
  }

  return {
    ...base,

    /** Persists one study answer atomically: card, buried siblings, log and leech tag. */
    async applyAnswer({ card, log, buried, tagLeech }: AnswerWrite): Promise<void> {
      const valid = [card, ...buried].map((c) => parseCard(c));
      const validLog = parseReviewLog(log);
      await db.transaction("rw", db.cards, db.reviewLogs, db.notes, async () => {
        await db.cards.bulkPut(valid);
        await db.reviewLogs.add(validLog);
        if (tagLeech) await setLeechTag(card.noteId, true, clock.now());
      });
    },

    /** Reverts an answer: cards back to their previous state, log marked undone, tag removed. */
    async undoAnswer({ before, buriedBefore, logId, untagLeech }: UndoWrite): Promise<void> {
      const now = clock.now();
      const restored = [before, ...buriedBefore].map((c) => parseCard({ ...c, updatedAt: now }));
      await db.transaction("rw", db.cards, db.reviewLogs, db.notes, async () => {
        await db.cards.bulkPut(restored);
        await db.reviewLogs.update(logId, { undoneAt: now });
        if (untagLeech) await setLeechTag(before.noteId, false, now);
      });
    },

    /** Stores a manually changed card (bury, suspend, flag…), validated and stamped. */
    async save(card: Card): Promise<Card> {
      const valid = parseCard({ ...card, updatedAt: clock.now() });
      await db.cards.put(valid);
      return valid;
    },

    /** Burials end when their study day starts. */
    async releaseBuried(today: string): Promise<void> {
      const buried = await db.cards.where("queue").equals("buried").toArray();
      const released = releaseBuried(buried, today, clock.now());
      if (released.length > 0) await db.cards.bulkPut(released.map((c) => parseCard(c)));
    },

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
