import { useLiveQuery } from "dexie-react-hooks";
import { runtime } from "../../../data/runtime";
import type { Note } from "../../../domain/model";

/** undefined while loading; null when the note does not exist (or was deleted). */
export function useNote(noteId: string): Note | null | undefined {
  return useLiveQuery(async () => {
    const note = await runtime().repos.notes.get(noteId);
    return note && note.deletedAt === null ? note : null;
  }, [noteId]);
}

export function useRecentlyAdded(enabled: boolean): Note[] | undefined {
  return useLiveQuery(
    async () => (enabled ? runtime().repos.notes.recentlyAdded() : []),
    [enabled],
  );
}
