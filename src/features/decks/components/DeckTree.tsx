import { Link } from "@tanstack/react-router";
import { t } from "../../../i18n";
import { Icon, IconButton } from "../../../ui";
import type { DeckRow } from "../model/deckList";
import { CountTriplet } from "./CountTriplet";

interface DeckTreeProps {
  rows: DeckRow[];
  onToggle: (row: DeckRow) => void;
  onActions: (row: DeckRow) => void;
}

export function DeckTree({ rows, onToggle, onActions }: DeckTreeProps) {
  return (
    <ul
      aria-label={t.decks.listLabel}
      className="divide-y divide-line-soft overflow-hidden rounded-list border border-line bg-surface"
    >
      {rows.map((row) => {
        const { deck, depth } = row.node;
        const expanded = !deck.collapsed;
        return (
          <li
            key={deck.id}
            className="flex items-center gap-1 pr-1"
            style={{ paddingLeft: depth * 16 }}
          >
            {row.hasChildren ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={expanded ? t.decks.collapse(deck.name) : t.decks.expand(deck.name)}
                onClick={() => onToggle(row)}
                className="inline-flex size-11 shrink-0 items-center justify-center text-faint"
              >
                <Icon
                  name="chevronRight"
                  className={`size-5 transition-transform ${expanded ? "rotate-90" : ""}`}
                />
              </button>
            ) : (
              <span aria-hidden="true" className="size-11 shrink-0" />
            )}
            <Link
              to="/decks/$deckId"
              params={{ deckId: deck.id }}
              className="flex min-h-11 flex-1 items-center truncate py-3 text-[15px] font-medium"
            >
              {deck.name}
            </Link>
            <CountTriplet counts={row.counts} />
            <IconButton
              icon="more"
              label={t.decks.actionsFor(deck.name)}
              onClick={() => onActions(row)}
            />
          </li>
        );
      })}
    </ul>
  );
}
