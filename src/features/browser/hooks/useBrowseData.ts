import { useLiveQuery } from "dexie-react-hooks";
import { runtime } from "../../../data/runtime";
import { endOfStudyDay } from "../../../domain/day";
import type { BrowseData } from "../model/browse";

/** Everything the browser searches, kept up to date with IndexedDB. */
export function useBrowseData(): BrowseData | undefined {
  return useLiveQuery(async () => {
    const { repos, clock, timeZone } = runtime();
    const [cards, notes, decks, noteTypes, cutoffHour] = await Promise.all([
      repos.cards.listActive(),
      repos.notes.listActive(),
      repos.decks.listActive(),
      repos.noteTypes.listActive(),
      repos.settings.get("cutoffHour"),
    ]);
    return {
      cards,
      notes,
      decks,
      noteTypes,
      endOfDay: endOfStudyDay(clock.now(), cutoffHour, timeZone),
    };
  }, []);
}

export function useBulkActions() {
  const bulk = () => runtime().repos.bulk;
  return {
    move: (cardIds: string[], deckId: string) => bulk().moveCards(cardIds, deckId),
    setSuspended: (cardIds: string[], suspended: boolean) =>
      bulk().setSuspended(cardIds, suspended),
    reschedule: (cardIds: string[], days: number) => bulk().reschedule(cardIds, days),
    forget: (cardIds: string[]) => bulk().forget(cardIds),
    addTags: (noteIds: string[], tags: string[]) => bulk().addTags(noteIds, tags),
    removeTags: (noteIds: string[], tags: string[]) => bulk().removeTags(noteIds, tags),
    deleteNotes: (noteIds: string[]) => bulk().deleteNotes(noteIds),
  };
}
