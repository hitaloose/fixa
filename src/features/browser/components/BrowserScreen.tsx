import { Link } from "@tanstack/react-router";
import { observeElementRect, useVirtualizer } from "@tanstack/react-virtual";
import { useId, useMemo, useRef, useState } from "react";
import { buildDeckTree, type DeckNode } from "../../../domain/decks";
import { parseTags } from "../../../domain/notes";
import { t } from "../../../i18n";
import { Button, SearchField, Select, Sheet, Stepper, TextField, Toast } from "../../../ui";
import { useBrowseData, useBulkActions } from "../hooks/useBrowseData";
import { type BrowseMode, type BrowseRow, browse, type SortKey, toggleTerm } from "../model/browse";

const b = t.browser;

export interface BrowserSearch {
  q: string;
  sort: SortKey;
  mode: BrowseMode;
}

const CHIPS = [
  ["due", "is:due"],
  ["new", "is:new"],
  ["suspended", "is:suspended"],
  ["flagged", "is:flagged"],
] as const;

type Dialog = "actions" | "move" | "tag" | "reschedule" | "forget" | "remove" | null;

function Row({
  row,
  selected,
  onToggle,
}: {
  row: BrowseRow;
  selected: boolean;
  onToggle: () => void;
}) {
  const text = row.text || b.untitled;
  const due = row.status === "review" || row.status === "learning" ? ` · ${b.due(row.due)}` : "";
  return (
    <div className="flex min-h-16 items-center gap-2 border-b border-line-soft px-1">
      <label className="flex size-11 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={b.select(text)}
          className="size-5 accent-primary"
        />
      </label>
      <div className="flex min-w-0 flex-1 flex-col py-2">
        <Link
          to="/notes/$noteId/edit"
          params={{ noteId: row.noteId }}
          className="truncate font-medium"
        >
          {text}
        </Link>
        <span className="truncate text-xs text-muted">
          {row.deckPath} · {b.status[row.status]}
          {due}
        </span>
      </div>
    </div>
  );
}

const FALLBACK_RECT = { width: 390, height: 800 };

function ResultList({
  rows,
  selected,
  onToggle,
}: {
  rows: BrowseRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 64,
    overscan: 8,
    // Before layout (first frame, jsdom) the scroller measures 0: assume a phone-sized one.
    initialRect: FALLBACK_RECT,
    observeElementRect: (instance, onRect) =>
      observeElementRect(instance, (rect) => onRect(rect.height > 0 ? rect : FALLBACK_RECT)),
  });
  return (
    <div ref={scroller} className="h-[calc(100dvh-20rem)] min-h-64 overflow-y-auto">
      <ul
        aria-label={b.results}
        className="relative"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index] as BrowseRow;
          return (
            <li
              key={row.id}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <Row row={row} selected={selected.has(row.id)} onToggle={() => onToggle(row.id)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConfirmSheet(props: {
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && props.onClose()}
      title={props.title}
      description={props.description}
      closeLabel={t.common.close}
    >
      <div className="flex gap-2">
        <Button variant="secondary" onClick={props.onClose} className="flex-1">
          {t.common.cancel}
        </Button>
        <Button variant="danger" onClick={props.onConfirm} className="flex-1">
          {props.confirm}
        </Button>
      </div>
    </Sheet>
  );
}

function flatDecks(nodes: DeckNode[]): DeckNode[] {
  return nodes.flatMap((n) => [n, ...flatDecks(n.children)]);
}

export function BrowserScreen({
  search,
  onSearchChange,
}: {
  search: BrowserSearch;
  onSearchChange: (search: BrowserSearch) => void;
}) {
  const data = useBrowseData();
  const actions = useBulkActions();
  const [state, setState] = useState(search);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [tags, setTags] = useState("");
  const [days, setDays] = useState(1);
  const sortId = useId();
  const moveToId = useId();

  const rows = useMemo(
    () => (data ? browse(data, { query: state.q, sort: state.sort, mode: state.mode }) : []),
    [data, state],
  );
  const decks = useMemo(() => (data ? flatDecks(buildDeckTree(data.decks)) : []), [data]);

  const update = (patch: Partial<BrowserSearch>) => {
    const next = { ...state, ...patch };
    setState(next);
    if (patch.mode) setSelected(new Set());
    onSearchChange(next);
  };

  const chosen = rows.filter((r) => selected.has(r.id));
  const cardIds = chosen.flatMap((r) => r.cardIds);
  const noteIds = [...new Set(chosen.map((r) => r.noteId))];

  const run = async (action: () => Promise<unknown>, message: string = b.done) => {
    setDialog(null);
    await action();
    setSelected(new Set());
    setToast(message);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const terms = state.q.split(/\s+/);
  const actionRow = "flex min-h-11 w-full items-center px-1 text-left font-medium";

  return (
    <div className="flex flex-col gap-3 pt-4">
      <h1 className="font-display text-[28px] font-bold">{b.title}</h1>
      <SearchField
        label={b.search}
        clearLabel={b.clearSearch}
        placeholder={b.searchHint}
        value={state.q}
        onChange={(q) => update({ q })}
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {CHIPS.map(([key, term]) => (
          <button
            key={key}
            type="button"
            aria-pressed={terms.includes(term)}
            onClick={() => update({ q: toggleTerm(state.q, term) })}
            className="min-h-11 shrink-0 rounded-chip border border-line bg-surface px-4 text-sm font-medium aria-pressed:border-primary aria-pressed:bg-new-bg aria-pressed:text-primary"
          >
            {b.chips[key]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={sortId} className="sr-only">
          {b.sortBy}
        </label>
        <Select
          id={sortId}
          value={state.sort}
          onChange={(e) => update({ sort: e.target.value as SortKey })}
          className="flex-1"
        >
          {(Object.keys(b.sorts) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {b.sorts[key]}
            </option>
          ))}
        </Select>
        <div className="flex rounded-button bg-line-soft p-1">
          {(["cards", "notes"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={state.mode === mode}
              onClick={() => update({ mode })}
              className="min-h-11 rounded-button px-3 text-sm font-medium aria-pressed:bg-surface aria-pressed:shadow-sm"
            >
              {b.modes[mode]}
            </button>
          ))}
        </div>
      </div>

      {data === undefined ? null : rows.length === 0 ? (
        <p className="py-8 text-center text-muted">{b.empty}</p>
      ) : (
        <>
          <p className="text-sm text-muted">{b.count(rows.length, state.mode)}</p>
          <ResultList rows={rows} selected={selected} onToggle={toggle} />
        </>
      )}

      {chosen.length > 0 ? (
        <section
          aria-label={b.selection}
          className="fixed inset-x-0 bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] z-40 flex items-center gap-1 border-t border-line bg-surface px-2 py-1"
        >
          <span className="flex-1 px-2 text-sm font-medium">{b.selected(chosen.length)}</span>
          <button
            type="button"
            className="min-h-11 px-2 text-sm text-primary"
            onClick={() => setSelected(new Set(rows.map((r) => r.id)))}
          >
            {b.selectAll}
          </button>
          <button
            type="button"
            className="min-h-11 px-2 text-sm text-muted"
            onClick={() => setSelected(new Set())}
          >
            {b.clearSelection}
          </button>
          <Button onClick={() => setDialog("actions")}>{b.actions}</Button>
        </section>
      ) : null}

      {dialog === "actions" ? (
        <Sheet
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={b.actions}
          closeLabel={t.common.close}
        >
          <div className="flex flex-col divide-y divide-line-soft">
            <button
              type="button"
              className={actionRow}
              onClick={() => {
                setMoveTo(decks[0]?.deck.id ?? "");
                setDialog("move");
              }}
            >
              {b.move}
            </button>
            <button type="button" className={actionRow} onClick={() => setDialog("tag")}>
              {b.tag}
            </button>
            <button type="button" className={actionRow} onClick={() => setDialog("reschedule")}>
              {b.reschedule}
            </button>
            <button type="button" className={actionRow} onClick={() => setDialog("forget")}>
              {b.forget}
            </button>
            <button
              type="button"
              className={actionRow}
              onClick={() => void run(() => actions.setSuspended(cardIds, true))}
            >
              {b.suspend}
            </button>
            <button
              type="button"
              className={actionRow}
              onClick={() => void run(() => actions.setSuspended(cardIds, false))}
            >
              {b.unsuspend}
            </button>
            <button
              type="button"
              className={`${actionRow} text-danger`}
              onClick={() => setDialog("remove")}
            >
              {b.remove}
            </button>
          </div>
        </Sheet>
      ) : null}

      {dialog === "move" ? (
        <Sheet
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={b.moveTitle}
          closeLabel={t.common.close}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={moveToId} className="text-sm font-medium">
                {b.deck}
              </label>
              <Select id={moveToId} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {decks.map((d) => (
                  <option key={d.deck.id} value={d.deck.id}>
                    {d.path}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              onClick={() => void run(() => actions.move(cardIds, moveTo))}
              disabled={!moveTo}
            >
              {b.move}
            </Button>
          </div>
        </Sheet>
      ) : null}

      {dialog === "tag" ? (
        <Sheet
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={b.tag}
          closeLabel={t.common.close}
        >
          <div className="flex flex-col gap-3">
            <TextField label={b.tags} value={tags} onChange={setTags} autoCapitalize="none" />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={parseTags(tags).length === 0}
                onClick={() => void run(() => actions.removeTags(noteIds, parseTags(tags)))}
              >
                {b.removeTags}
              </Button>
              <Button
                className="flex-1"
                disabled={parseTags(tags).length === 0}
                onClick={() => void run(() => actions.addTags(noteIds, parseTags(tags)))}
              >
                {b.addTags}
              </Button>
            </div>
          </div>
        </Sheet>
      ) : null}

      {dialog === "reschedule" ? (
        <Sheet
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={b.reschedule}
          description={b.rescheduleHint}
          closeLabel={t.common.close}
        >
          <div className="flex flex-col gap-3">
            <Stepper label={b.rescheduleDays} value={days} onChange={setDays} min={0} max={36500} />
            <Button
              onClick={() => {
                setDialog(null);
                void actions.reschedule(cardIds, days).then((n) => {
                  setSelected(new Set());
                  setToast(b.rescheduled(n));
                });
              }}
            >
              {b.reschedule}
            </Button>
          </div>
        </Sheet>
      ) : null}

      {dialog === "forget" ? (
        <ConfirmSheet
          title={b.forgetTitle}
          description={b.forgetDescription}
          confirm={b.forget}
          onClose={() => setDialog(null)}
          onConfirm={() => void run(() => actions.forget(cardIds))}
        />
      ) : null}

      {dialog === "remove" ? (
        <ConfirmSheet
          title={b.removeTitle}
          description={b.removeDescription}
          confirm={b.remove}
          onClose={() => setDialog(null)}
          onConfirm={() => void run(() => actions.deleteNotes(noteIds))}
        />
      ) : null}

      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
