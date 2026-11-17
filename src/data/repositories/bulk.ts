import { type Card, type Note, parseCard, parseNote, parseReviewLog } from "../../domain/model";
import { parseTags } from "../../domain/notes";
import type { Clock, IdGenerator } from "../../domain/ports";
import { setFlag, suspendCard, unsuspendCard } from "../../domain/queue";
import { forget, reschedule } from "../../domain/scheduler";
import type { FixaDb } from "../db";

/** Browser actions on many cards/notes at once; each runs in one transaction. */
export function createBulkRepository({
  db,
  clock,
  ids,
}: {
  db: FixaDb;
  clock: Clock;
  ids: IdGenerator;
}) {
  async function activeCards(cardIds: readonly string[]): Promise<Card[]> {
    const cards = await db.cards.bulkGet([...cardIds]);
    return cards.filter((c): c is Card => c !== undefined && c.deletedAt === null);
  }

  async function activeNotes(noteIds: readonly string[]): Promise<Note[]> {
    const notes = await db.notes.bulkGet([...noteIds]);
    return notes.filter((n): n is Note => n !== undefined && n.deletedAt === null);
  }

  /** Rewrites each card with `change`, validated. */
  function updateCards(cardIds: readonly string[], change: (card: Card, now: number) => Card) {
    return db.transaction("rw", db.cards, async () => {
      const now = clock.now();
      const cards = await activeCards(cardIds);
      await db.cards.bulkPut(cards.map((c) => parseCard(change(c, now))));
    });
  }

  function updateTags(noteIds: readonly string[], change: (tags: string[]) => string[]) {
    return db.transaction("rw", db.notes, async () => {
      const now = clock.now();
      const notes = await activeNotes(noteIds);
      await db.notes.bulkPut(
        notes.map((n) => parseNote({ ...n, tags: change(n.tags), updatedAt: now })),
      );
    });
  }

  return {
    moveCards: (cardIds: readonly string[], deckId: string) =>
      updateCards(cardIds, (c, now) => ({ ...c, deckId, updatedAt: now })),

    setSuspended: (cardIds: readonly string[], suspended: boolean) =>
      updateCards(cardIds, (c, now) => (suspended ? suspendCard(c, now) : unsuspendCard(c, now))),

    setFlag: (cardIds: readonly string[], flag: number) =>
      updateCards(cardIds, (c, now) => setFlag(c, flag, now)),

    /** Studied cards become due in `days` days (new ones are skipped). Returns how many. */
    reschedule: (cardIds: readonly string[], days: number) =>
      db.transaction("rw", db.cards, db.reviewLogs, async () => {
        const now = clock.now();
        const results = (await activeCards(cardIds)).flatMap((c) => {
          const r = reschedule(c, days, now, ids.next());
          return r ? [r] : [];
        });
        await db.cards.bulkPut(results.map((r) => parseCard(r.card)));
        await db.reviewLogs.bulkAdd(results.map((r) => parseReviewLog(r.log)));
        return results.length;
      }),

    forget: (cardIds: readonly string[]) =>
      db.transaction("rw", db.cards, db.reviewLogs, async () => {
        const now = clock.now();
        const results = (await activeCards(cardIds)).map((c) => forget(c, now, ids.next()));
        await db.cards.bulkPut(results.map((r) => parseCard(r.card)));
        await db.reviewLogs.bulkAdd(results.map((r) => parseReviewLog(r.log)));
      }),

    addTags: (noteIds: readonly string[], tags: readonly string[]) => {
      const added = parseTags(tags.join(" "));
      return updateTags(noteIds, (current) => [...new Set([...current, ...added])]);
    },

    removeTags: (noteIds: readonly string[], tags: readonly string[]) => {
      const removed = new Set(parseTags(tags.join(" ")));
      return updateTags(noteIds, (current) => current.filter((t) => !removed.has(t)));
    },

    /** Soft-deletes notes and every card of them (they can be restored from the trash). */
    deleteNotes: (noteIds: readonly string[]) =>
      db.transaction("rw", db.notes, db.cards, async () => {
        const now = clock.now();
        const notes = await activeNotes(noteIds);
        await db.notes.bulkPut(notes.map((n) => ({ ...n, deletedAt: now, updatedAt: now })));
        await db.cards
          .where("noteId")
          .anyOf(notes.map((n) => n.id))
          .filter((c) => c.deletedAt === null)
          .modify((c) => {
            c.deletedAt = now;
            c.updatedAt = now;
          });
      }),
  };
}
