import { useMemo, useState } from "react";
import { buildDeckTree, visibleRows } from "../../../domain/decks";
import { t } from "../../../i18n/pt-BR";
import { Button, Icon, SearchField } from "../../../ui";
import { useDeckActions } from "../hooks/useDeckActions";
import { useDeckList } from "../hooks/useDeckList";
import type { DeckRow } from "../model/deckList";
import { DeckActionsSheet } from "./DeckActionsSheet";
import { DeckTree } from "./DeckTree";
import { NewDeckSheet } from "./NewDeckSheet";
import { TodaySummary } from "./TodaySummary";

export function DeckListScreen() {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<DeckRow | null>(null);
  const list = useDeckList(query);
  const { setCollapsed } = useDeckActions();

  const allDecks = useMemo(() => {
    if (!list) return [];
    const unfiltered = list.allDecks;
    return visibleRows(buildDeckTree(unfiltered.map((d) => ({ ...d, collapsed: false })))).map(
      (n) => ({
        deck: n.deck,
        path: n.path,
      }),
    );
  }, [list]);

  if (!list) return null;
  const hasDecks = list.allDecks.length > 0;

  return (
    <div className="flex flex-col gap-4 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[32px] font-bold">{t.decks.title}</h1>
        <Button onClick={() => setCreating(true)}>
          <Icon name="add" className="size-5" />
          {t.decks.newDeck}
        </Button>
      </header>

      {hasDecks ? (
        <>
          <TodaySummary summary={list.summary} />
          <SearchField
            label={t.decks.search}
            placeholder={t.decks.search}
            clearLabel={t.decks.clearSearch}
            value={query}
            onChange={setQuery}
          />
          {list.rows.length > 0 ? (
            <DeckTree
              rows={list.rows}
              onToggle={(row) => void setCollapsed(row.node.deck.id, !row.node.deck.collapsed)}
              onActions={setActing}
            />
          ) : (
            <p className="py-6 text-center text-muted">{t.decks.noResults}</p>
          )}
        </>
      ) : (
        <div className="rounded-section border border-line bg-surface p-6 text-center">
          <p className="font-semibold">{t.decks.empty}</p>
          <p className="mt-1 text-sm text-muted">{t.decks.emptyHint}</p>
        </div>
      )}

      {creating ? <NewDeckSheet onClose={() => setCreating(false)} /> : null}
      <DeckActionsSheet row={acting} targets={allDecks} onClose={() => setActing(null)} />
    </div>
  );
}
