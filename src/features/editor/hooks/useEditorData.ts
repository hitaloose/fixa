import { useLiveQuery } from "dexie-react-hooks";
import { runtime } from "../../../data/runtime";
import { SEED_IDS } from "../../../data/seed";
import { buildDeckTree, type DeckNode } from "../../../domain/decks";
import type { Deck, NoteType } from "../../../domain/model";

export interface DeckOption {
  id: string;
  path: string;
}

const SEED_ORDER: string[] = [SEED_IDS.basic, SEED_IDS.basicReversed, SEED_IDS.cloze];
const rank = (nt: NoteType) => {
  const i = SEED_ORDER.indexOf(nt.id);
  return i === -1 ? SEED_ORDER.length : i;
};

/** Default note types first (in their usual order), then the others by name. */
export function sortNoteTypes(noteTypes: readonly NoteType[]): NoteType[] {
  return [...noteTypes].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "pt-BR"));
}

/** Every deck in tree order, labelled by its full path. */
export function deckOptions(decks: readonly Deck[]): DeckOption[] {
  const flat = (nodes: DeckNode[]): DeckOption[] =>
    nodes.flatMap((n) => [{ id: n.deck.id, path: n.path }, ...flat(n.children)]);
  return flat(buildDeckTree(decks));
}

export interface EditorData {
  noteTypes: NoteType[];
  decks: DeckOption[];
}

export function useEditorData(): EditorData | undefined {
  return useLiveQuery(async () => {
    const { repos } = runtime();
    const [noteTypes, decks] = await Promise.all([
      repos.noteTypes.listActive(),
      repos.decks.listActive(),
    ]);
    return { noteTypes: sortNoteTypes(noteTypes), decks: deckOptions(decks) };
  }, []);
}
