import { type NoteEdit, type NoteInput, NoteOperationError } from "../../../data/repositories";
import { runtime } from "../../../data/runtime";
import type { NoteType } from "../../../domain/model";

export type NoteActionError = NoteOperationError["code"];

async function attempt(op: () => Promise<unknown>): Promise<NoteActionError | null> {
  try {
    await op();
    return null;
  } catch (error) {
    if (error instanceof NoteOperationError) return error.code;
    throw error;
  }
}

export function useNoteActions() {
  const repos = () => runtime().repos;
  return {
    add: (input: NoteInput) => attempt(() => repos().notes.add(input)),
    edit: (id: string, change: NoteEdit) => attempt(() => repos().notes.edit(id, change)),
    /** Whether the first field's text already exists in another note of the same type. */
    hasDuplicate: async (noteTypeId: string, firstField: string, exceptId?: string) =>
      (await repos().notes.duplicatesOf(noteTypeId, firstField, exceptId)).length > 0,
    setSticky: (noteType: NoteType, fieldId: string, sticky: boolean) =>
      repos().noteTypes.update(noteType.id, {
        fields: noteType.fields.map((f) => (f.id === fieldId ? { ...f, sticky } : f)),
      }),
  };
}
