import { type Card, type NoteType, parseCard, parseNoteType } from "../../domain/model";
import { newCard } from "../../domain/notes";
import type { Clock, IdGenerator } from "../../domain/ports";
import { generateCards } from "../../domain/templates";
import type { FixaDb } from "../db";
import { createEntityRepository } from "./entityRepository";

export function createNoteTypesRepository({
  db,
  clock,
  ids,
}: {
  db: FixaDb;
  clock: Clock;
  ids: IdGenerator;
}) {
  const base = createEntityRepository({ table: db.noteTypes, parse: parseNoteType, clock, ids });

  return {
    ...base,

    /**
     * Saves an edited note type and keeps the cards in step: cards follow their template by id
     * (templateOrd is re-numbered), cards of removed templates go to the trash, and templates
     * that now generate a card get one for every note.
     */
    async saveEdited(edited: NoteType): Promise<NoteType> {
      const now = clock.now();
      return db.transaction("rw", db.noteTypes, db.notes, db.cards, async () => {
        const current = await db.noteTypes.get(edited.id);
        if (!current) throw new Error(`noteType ${edited.id} not found`);
        const next = parseNoteType({ ...edited, updatedAt: now });
        await db.noteTypes.put(next);

        const newOrdById = new Map(next.templates.map((t, i) => [t.id, i]));
        const notes = (await db.notes.where("noteTypeId").equals(next.id).toArray()).filter(
          (n) => n.deletedAt === null,
        );
        for (const note of notes) {
          const cards = (await db.cards.where("noteId").equals(note.id).toArray()).filter(
            (c) => c.deletedAt === null,
          );
          const kept: Card[] = [];
          for (const card of cards) {
            if (next.kind === "cloze") {
              kept.push(card);
              continue;
            }
            const templateId = current.templates[card.templateOrd]?.id;
            const ord = templateId === undefined ? undefined : newOrdById.get(templateId);
            const updated =
              ord === undefined
                ? { ...card, deletedAt: now, updatedAt: now }
                : ord === card.templateOrd
                  ? card
                  : { ...card, templateOrd: ord, updatedAt: now };
            if (updated !== card) await db.cards.put(parseCard(updated));
            if (ord !== undefined) kept.push(updated);
          }
          const deckId = kept[0]?.deckId ?? cards[0]?.deckId;
          if (!deckId) continue;
          const have = new Set(kept.map((c) => c.templateOrd));
          for (const ord of generateCards(next, note)) {
            if (have.has(ord)) continue;
            await db.cards.add(
              parseCard(
                newCard({ id: ids.next(), noteId: note.id, deckId, templateOrd: ord, now }),
              ),
            );
          }
        }
        return next;
      });
    },

    async cloneFrom(sourceId: string, name: string): Promise<NoteType> {
      const source = await db.noteTypes.get(sourceId);
      if (!source) throw new Error(`noteType ${sourceId} not found`);
      const { id, createdAt, updatedAt, deletedAt, ...rest } = source;
      return base.create({ ...rest, name });
    },

    /** Moves an unused note type to the trash. */
    async remove(id: string): Promise<void> {
      const used = await db.notes
        .where("noteTypeId")
        .equals(id)
        .filter((n) => n.deletedAt === null)
        .count();
      if (used > 0) throw new Error("note type is in use");
      await base.softDelete(id);
    },
  };
}
