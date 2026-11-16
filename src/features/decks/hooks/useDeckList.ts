import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { runtime } from "../../../data/runtime";
import { endOfStudyDay, startOfStudyDay } from "../../../domain/day";
import { buildDeckList, type DeckList, type DeckListInput } from "../model/deckList";

/** Loads everything the deck list needs from IndexedDB (reactive). */
export function loadDeckListData(): Promise<Omit<DeckListInput, "query">> {
  return (async () => {
    const { repos, clock, timeZone } = runtime();
    const now = clock.now();
    const cutoffHour = await repos.settings.get("cutoffHour");
    const [decks, presets, cards, logsToday, recentLogs] = await Promise.all([
      repos.decks.listActive(),
      repos.presets.listActive(),
      repos.cards.studyCandidates(endOfStudyDay(now, cutoffHour, timeZone)),
      repos.reviewLogs.since(startOfStudyDay(now, cutoffHour, timeZone)),
      repos.reviewLogs.recent(200),
    ]);
    return { decks, presets, cards, logsToday, recentLogs, now, cutoffHour, timeZone };
  })();
}

export function useDeckList(query: string): DeckList | undefined {
  const data = useLiveQuery(loadDeckListData, []);
  return useMemo(() => (data ? buildDeckList({ ...data, query }) : undefined), [data, query]);
}
