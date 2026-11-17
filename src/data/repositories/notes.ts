import { type Card, type Note, type NoteType, parseCard, parseNote } from "../../domain/model";
import { newCard, plainText, planCardChanges } from "../../domain/notes";
import type { Clock, IdGenerator } from "../../domain/ports";
import { generateCards } from "../../domain/templates";
import { sha256Hex } from "../../lib/hash";
import type { FixaDb } from "../db";
import { createEntityRepository } from "./entityRepository";
import { NoteOperationError } from "./errors";

export interface NoteInput {
  noteTypeId: string;
  deckId: string;
  fields: Note["fields"];
  tags: string[];
}

export interface NoteEdit {
  fields: Note["fields"];
  tags: string[];
}

/** How many additions the "Histórico de adições" keeps. */
const HISTORY_SIZE = 100;

const firstField = (noteType: NoteType, fields: Note["fields"]) =>
  fields[noteType.fields[0]?.id ?? ""] ?? "";

/** sortField and checksum both derive from the first field's plain text. */
async function derived(noteType: NoteType, fields: Note["fields"]) {
  const sortField = plainText(firstField(noteType, fields));
  return { sortField, checksum: await sha256Hex(sortField) };
}

export function createNotesRepository({
  db,
  clock,
  ids,
}: {
  db: FixaDb;
  clock: Clock;
  ids: IdGenerator;
}) {
  const base = createEntityRepository({ table: db.notes, parse: parseNote, clock, ids });

  async function mustGetNoteType(id: string): Promise<NoteType> {
    const noteType = await db.noteTypes.get(id);
    if (!noteType) throw new NoteOperationError("not-found");
    return noteType;
  }

  function generatedOrThrow(noteType: NoteType, note: Note): number[] {
    const ords = generateCards(noteType, note);
    if (ords.length === 0) throw new NoteOperationError("no-cards");
    return ords;
  }

  return {
    ...base,

    /** Adds a note and its cards (one per generated template) in one transaction. */
    async add(input: NoteInput): Promise<{ note: Note; cards: Card[] }> {
      const noteType = await mustGetNoteType(input.noteTypeId);
      const now = clock.now();
      const note = parseNote({
        id: ids.next(),
        noteTypeId: input.noteTypeId,
        fields: input.fields,
        tags: input.tags,
        ...(await derived(noteType, input.fields)),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      const cards = generatedOrThrow(noteType, note).map((templateOrd) =>
        parseCard(
          newCard({ id: ids.next(), noteId: note.id, deckId: input.deckId, templateOrd, now }),
        ),
      );
      await db.transaction("rw", db.notes, db.cards, db.addHistory, async () => {
        await db.notes.add(note);
        await db.cards.bulkAdd(cards);
        await db.addHistory.add({ noteId: note.id, addedAt: now });
        const excess = (await db.addHistory.count()) - HISTORY_SIZE;
        if (excess > 0) await db.addHistory.orderBy("id").limit(excess).delete();
      });
      return { note, cards };
    },

    /**
     * Saves new field contents and tags. Cards follow the templates: new ones are created
     * (in the deck of the note's cards), ones that stop generating are soft-deleted, and a
     * removed card whose template generates again is restored with its history.
     */
    async edit(id: string, change: NoteEdit): Promise<Note> {
      const current = await db.notes.get(id);
      if (!current) throw new NoteOperationError("not-found");
      const noteType = await mustGetNoteType(current.noteTypeId);
      const now = clock.now();
      const note = parseNote({
        ...current,
        ...change,
        ...(await derived(noteType, change.fields)),
        updatedAt: now,
      });
      const generated = generatedOrThrow(noteType, note);
      await db.transaction("rw", db.notes, db.cards, async () => {
        const cards = await db.cards.where("noteId").equals(id).toArray();
        const plan = planCardChanges(generated, cards);
        const deckId = [...cards].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.deckId;
        await db.notes.put(note);
        for (const cardId of plan.restore) {
          await db.cards.update(cardId, { deletedAt: null, updatedAt: now });
        }
        for (const cardId of plan.remove) {
          await db.cards.update(cardId, { deletedAt: now, updatedAt: now });
        }
        if (deckId !== undefined && plan.create.length > 0) {
          await db.cards.bulkAdd(
            plan.create.map((templateOrd) =>
              parseCard(newCard({ id: ids.next(), noteId: id, deckId, templateOrd, now })),
            ),
          );
        }
      });
      return note;
    },

    /** Active notes of the same type whose first field has the same text (duplicate warning). */
    async duplicatesOf(noteTypeId: string, firstFieldHtml: string, exceptId?: string) {
      const text = plainText(firstFieldHtml);
      if (text === "") return [];
      const checksum = await sha256Hex(text);
      return db.notes
        .where("checksum")
        .equals(checksum)
        .filter((n) => n.noteTypeId === noteTypeId && n.deletedAt === null && n.id !== exceptId)
        .toArray();
    },

    /** Most recently added notes that still exist, newest first. */
    async recentlyAdded(limit = 50): Promise<Note[]> {
      const entries = await db.addHistory.orderBy("id").reverse().toArray();
      const noteIds = [...new Set(entries.map((e) => e.noteId))];
      const notes = await db.notes.bulkGet(noteIds);
      return notes
        .filter((n): n is Note => n !== undefined && n.deletedAt === null)
        .slice(0, limit);
    },
  };
}
