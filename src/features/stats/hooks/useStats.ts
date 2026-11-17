import { useLiveQuery } from "dexie-react-hooks";
import { runtime } from "../../../data/runtime";
import { buildDeckTree, type DeckNode, subtreeIds } from "../../../domain/decks";
import { buildStats, type StatsView } from "../../../domain/stats";

const YEAR_MS = 366 * 86_400_000;

export interface StatsData {
  view: StatsView;
  decks: Array<{ id: string; path: string }>;
  today: string;
}

const flat = (nodes: DeckNode[]): Array<{ id: string; path: string }> =>
  nodes.flatMap((n) => [{ id: n.deck.id, path: n.path }, ...flat(n.children)]);

/** Stats for one deck (with subdecks) or all decks, over the last `periodDays` days. */
export function useStats(deckId: string | null, periodDays: number): StatsData | undefined {
  return useLiveQuery(async () => {
    const { repos, clock, timeZone } = runtime();
    const now = clock.now();
    const [decks, cutoffHour, allLogs] = await Promise.all([
      repos.decks.listActive(),
      repos.settings.get("cutoffHour"),
      repos.reviewLogs.since(now - YEAR_MS),
    ]);
    const cards = deckId
      ? await repos.cards.inDecks(subtreeIds(deckId, decks))
      : await repos.cards.listActive();
    const inScope = new Set(cards.map((c) => c.id));
    const logs = deckId ? allLogs.filter((l) => inScope.has(l.cardId)) : allLogs;
    const view = buildStats({ logs, cards, now, cutoffHour, timeZone, periodDays });
    return { view, decks: flat(buildDeckTree(decks)), today: view.daily.at(-1)?.day ?? "" };
  }, [deckId, periodDays]);
}
