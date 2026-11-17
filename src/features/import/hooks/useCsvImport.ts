import { useLiveQuery } from "dexie-react-hooks";
import type { DuplicatePolicy } from "../../../data/repositories";
import { runtime } from "../../../data/runtime";
import { SEED_IDS } from "../../../data/seed";
import { buildDeckTree, type DeckNode } from "../../../domain/decks";
import type { Note, NoteType } from "../../../domain/model";

export interface ImportTargets {
  noteTypes: NoteType[];
  decks: Array<{ id: string; path: string }>;
}

const SEED_ORDER: string[] = [SEED_IDS.basic, SEED_IDS.basicReversed, SEED_IDS.cloze];
const flat = (nodes: DeckNode[]): Array<{ id: string; path: string }> =>
  nodes.flatMap((n) => [{ id: n.deck.id, path: n.path }, ...flat(n.children)]);

export function useImportTargets(): ImportTargets | undefined {
  return useLiveQuery(async () => {
    const { repos } = runtime();
    const [noteTypes, decks] = await Promise.all([
      repos.noteTypes.listActive(),
      repos.decks.listActive(),
    ]);
    const rank = (nt: NoteType) => {
      const i = SEED_ORDER.indexOf(nt.id);
      return i === -1 ? SEED_ORDER.length : i;
    };
    return {
      noteTypes: [...noteTypes].sort(
        (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "pt-BR"),
      ),
      decks: flat(buildDeckTree(decks)),
    };
  }, []);
}

export function useCsvImport() {
  return (input: {
    noteTypeId: string;
    deckId: string;
    notes: Array<Pick<Note, "fields" | "tags">>;
    duplicates: DuplicatePolicy;
  }) => runtime().repos.notes.importMany(input);
}
