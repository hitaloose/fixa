import { type FormEvent, useId, useState } from "react";
import type { DeckErrorCode } from "../../../data/repositories";
import { subtreeIds } from "../../../domain/decks";
import type { Deck } from "../../../domain/model";
import { t } from "../../../i18n/pt-BR";
import { Button, Select, Sheet, TextField } from "../../../ui";
import { useDeckActions } from "../hooks/useDeckActions";
import type { DeckRow } from "../model/deckList";

type Mode = "menu" | "rename" | "subdeck" | "move" | "delete";

interface DeckActionsSheetProps {
  row: DeckRow | null;
  /** All active decks with their paths, for the move target list. */
  targets: { deck: Deck; path: string }[];
  onClose: () => void;
  /** Exports the deck (with subdecks) as an Anki package. */
  onExport?: (deckId: string) => void;
}

export function DeckActionsSheet({ row, targets, onClose, onExport }: DeckActionsSheetProps) {
  const actions = useDeckActions();
  const [mode, setMode] = useState<Mode>("menu");
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const parentId = useId();
  const [error, setError] = useState<DeckErrorCode | null>(null);

  if (!row) return null;
  const { deck, path } = row.node;

  const close = () => {
    setMode("menu");
    setError(null);
    onClose();
  };
  const go = (next: Mode) => {
    setError(null);
    setName(next === "rename" ? deck.name : "");
    setParent(deck.parentId ?? "");
    setMode(next);
  };
  const run = async (op: () => Promise<DeckErrorCode | null>) => {
    const failure = await op();
    if (failure) setError(failure);
    else close();
  };
  const submit = (op: () => Promise<DeckErrorCode | null>) => (e: FormEvent) => {
    e.preventDefault();
    void run(op);
  };

  const excluded = new Set(
    subtreeIds(
      deck.id,
      targets.map((x) => x.deck),
    ),
  );
  const errorText = error ? t.decks.errors[error] : undefined;

  const title = mode === "delete" ? t.decks.remove.title(deck.name) : deck.name;
  const description = mode === "delete" ? t.decks.remove.description : undefined;

  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? undefined : close())}
      title={title}
      {...(description ? { description } : {})}
      closeLabel={t.common.close}
    >
      {mode === "menu" ? (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => go("rename")}>
            {t.decks.actions.rename}
          </Button>
          <Button variant="secondary" onClick={() => go("subdeck")}>
            {t.decks.actions.addSubdeck}
          </Button>
          <Button variant="secondary" onClick={() => go("move")}>
            {t.decks.actions.move}
          </Button>
          {onExport ? (
            <Button
              variant="secondary"
              onClick={() => {
                onExport(deck.id);
                close();
              }}
            >
              {t.decks.actions.exportAnki}
            </Button>
          ) : null}
          <Button variant="danger" onClick={() => go("delete")}>
            {t.decks.actions.delete}
          </Button>
        </div>
      ) : null}

      {mode === "rename" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={submit(() => actions.rename(deck.id, name))}
        >
          <TextField
            label={t.decks.form.name}
            value={name}
            onChange={setName}
            autoFocus
            {...(errorText ? { error: errorText } : {})}
          />
          <Button type="submit">{t.decks.form.save}</Button>
        </form>
      ) : null}

      {mode === "subdeck" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={submit(() => actions.create(`${path}::${name}`))}
        >
          <TextField
            label={t.decks.form.name}
            value={name}
            onChange={setName}
            autoFocus
            {...(errorText ? { error: errorText } : {})}
          />
          <Button type="submit">{t.decks.form.create}</Button>
        </form>
      ) : null}

      {mode === "move" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={submit(() => actions.move(deck.id, parent || null))}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={parentId} className="text-sm font-medium">
              {t.decks.move.label}
            </label>
            <Select id={parentId} value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">{t.decks.move.topLevel}</option>
              {targets
                .filter((x) => !excluded.has(x.deck.id))
                .map((x) => (
                  <option key={x.deck.id} value={x.deck.id}>
                    {x.path}
                  </option>
                ))}
            </Select>
          </div>
          {errorText ? (
            <p role="alert" className="text-xs text-danger">
              {errorText}
            </p>
          ) : null}
          <Button type="submit">{t.decks.move.confirm}</Button>
        </form>
      ) : null}

      {mode === "delete" ? (
        <div className="flex flex-col gap-2">
          <Button variant="danger" onClick={() => void run(() => actions.remove(deck.id))}>
            {t.decks.remove.confirm}
          </Button>
          <Button variant="secondary" onClick={close}>
            {t.common.cancel}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
