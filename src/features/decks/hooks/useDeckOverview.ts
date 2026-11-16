import { useLiveQuery } from "dexie-react-hooks";
import { runtime } from "../../../data/runtime";
import { subtreeIds } from "../../../domain/decks";
import { buildDeckOverview, type DeckOverview } from "../model/deckOverview";
import { loadDeckListData } from "./useDeckList";

/** undefined while loading; null when the deck does not exist. */
export function useDeckOverview(deckId: string): DeckOverview | null | undefined {
  return useLiveQuery(async () => {
    const data = await loadDeckListData();
    const deckCards = await runtime().repos.cards.inDecks(subtreeIds(deckId, data.decks));
    return buildDeckOverview(deckId, { ...data, deckCards });
  }, [deckId]);
}
