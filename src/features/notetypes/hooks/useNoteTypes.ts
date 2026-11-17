import { useLiveQuery } from "dexie-react-hooks";
import { runtime } from "../../../data/runtime";
import type { NoteType } from "../../../domain/model";

export function useNoteTypeList() {
  return useLiveQuery(async () => {
    const { repos } = runtime();
    const [noteTypes, notes] = await Promise.all([
      repos.noteTypes.listActive(),
      repos.notes.listActive(),
    ]);
    const counts = new Map<string, number>();
    for (const n of notes) counts.set(n.noteTypeId, (counts.get(n.noteTypeId) ?? 0) + 1);
    return [...noteTypes]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((noteType) => ({ noteType, notes: counts.get(noteType.id) ?? 0 }));
  }, []);
}

/** undefined while loading; null when it does not exist. */
export function useNoteType(id: string): NoteType | null | undefined {
  return useLiveQuery(async () => {
    const nt = await runtime().repos.noteTypes.get(id);
    return nt && nt.deletedAt === null ? nt : null;
  }, [id]);
}

export function useNoteTypeActions() {
  const repos = () => runtime().repos.noteTypes;
  return {
    clone: (sourceId: string, name: string) => repos().cloneFrom(sourceId, name),
    remove: (id: string) => repos().remove(id),
    save: (nt: NoteType) => repos().saveEdited(nt),
    ids: () => runtime().ids,
  };
}
