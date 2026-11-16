import {
  checkMove,
  parseDeckPath,
  planDeckPath,
  siblingNameTaken,
  subtreeIds,
} from "../../domain/decks";
import { type Deck, parseDeck } from "../../domain/model";
import type { Clock, IdGenerator } from "../../domain/ports";
import type { FixaDb } from "../db";
import { createEntityRepository } from "./entityRepository";
import { DeckOperationError } from "./errors";

function validNodeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "" || trimmed.includes("::")) throw new DeckOperationError("invalid-name");
  return trimmed;
}

export function createDecksRepository({
  db,
  clock,
  ids,
}: {
  db: FixaDb;
  clock: Clock;
  ids: IdGenerator;
}) {
  const base = createEntityRepository({ table: db.decks, parse: parseDeck, clock, ids });
  const active = () => db.decks.filter((d) => d.deletedAt === null).toArray();
  const mustGet = async (id: string): Promise<Deck> => {
    const deck = await db.decks.get(id);
    if (!deck || deck.deletedAt !== null) throw new DeckOperationError("not-found");
    return deck;
  };

  return {
    ...base,

    /** Creates "A::B::C", reusing existing ancestors; returns the leaf. */
    createByPath: (path: string, presetId: string): Promise<Deck> =>
      db.transaction("rw", db.decks, async () => {
        try {
          parseDeckPath(path);
        } catch {
          throw new DeckOperationError("invalid-name");
        }
        const plan = planDeckPath(path, await active());
        if (plan.existing) throw new DeckOperationError("exists");
        let parentId = plan.parentId;
        let leaf: Deck | undefined;
        for (const name of plan.missing) {
          leaf = await base.create({
            name,
            parentId,
            presetId,
            description: "",
            collapsed: false,
            overrides: {},
            position: 0,
          });
          parentId = leaf.id;
        }
        return leaf as Deck;
      }),

    rename: (id: string, name: string): Promise<Deck> =>
      db.transaction("rw", db.decks, async () => {
        const deck = await mustGet(id);
        const newName = validNodeName(name);
        if (siblingNameTaken(newName, deck.parentId, await active(), id)) {
          throw new DeckOperationError("name-taken");
        }
        return base.update(id, { name: newName });
      }),

    move: (id: string, parentId: string | null): Promise<Deck> =>
      db.transaction("rw", db.decks, async () => {
        await mustGet(id);
        const check = checkMove(id, parentId, await active());
        if (check !== "ok") throw new DeckOperationError(check);
        return base.update(id, { parentId });
      }),

    setCollapsed: async (id: string, collapsed: boolean): Promise<void> => {
      await base.update(id, { collapsed });
    },

    /** Soft-deletes the deck, its subdecks, their cards and notes left without active cards. */
    deleteWithSubtree: (id: string): Promise<void> =>
      db.transaction("rw", db.decks, db.cards, db.notes, async () => {
        const now = clock.now();
        const stamp = { deletedAt: now, updatedAt: now };
        const deckIds = subtreeIds(id, await active());
        await db.decks.where("id").anyOf(deckIds).modify(stamp);
        const cards = await db.cards
          .where("deckId")
          .anyOf(deckIds)
          .filter((c) => c.deletedAt === null)
          .toArray();
        await db.cards
          .where("id")
          .anyOf(cards.map((c) => c.id))
          .modify(stamp);
        const noteIds = [...new Set(cards.map((c) => c.noteId))];
        for (const noteId of noteIds) {
          const remaining = await db.cards
            .where("noteId")
            .equals(noteId)
            .filter((c) => c.deletedAt === null)
            .count();
          if (remaining === 0) await db.notes.where("id").equals(noteId).modify(stamp);
        }
      }),
  };
}
