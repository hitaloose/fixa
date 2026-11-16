/**
 * Dexie schema v1. NEVER edit after it is published — add v2.ts with an upgrade() instead
 * (docs/06-dados-e-backup.md › Migrações).
 */
export const v1 = {
  presets: "id, deletedAt",
  decks: "id, parentId, presetId, deletedAt",
  noteTypes: "id, deletedAt",
  notes: "id, noteTypeId, checksum, *tags, updatedAt, deletedAt",
  cards:
    "id, noteId, deckId, [deckId+queue+due], [deckId+queue+newPosition], queue, due, flag, deletedAt",
  reviewLogs: "id, cardId, reviewedAt, [cardId+reviewedAt]",
  media: "id, fileName",
  addHistory: "++id, noteId",
  settings: "key",
} as const;
