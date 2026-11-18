import { type FormEvent, useState } from "react";
import type { DeckErrorCode } from "../../../data/repositories";
import { t } from "../../../i18n";
import { Button, Sheet, TextField } from "../../../ui";
import { useDeckActions } from "../hooks/useDeckActions";

/** Mounted only while open (unmounting also restores the page's aria-hidden state). */
export function NewDeckSheet({ onClose }: { onClose: () => void }) {
  const { create } = useDeckActions();
  const [name, setName] = useState("");
  const [error, setError] = useState<DeckErrorCode | null>(null);

  const close = onClose;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const failure = await create(name);
    if (failure) setError(failure);
    else close();
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => (o ? undefined : close())}
      title={t.decks.newDeck}
      closeLabel={t.common.close}
    >
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <TextField
          label={t.decks.form.name}
          hint={t.decks.form.pathHint}
          value={name}
          onChange={setName}
          autoFocus
          {...(error ? { error: t.decks.errors[error] } : {})}
        />
        <Button type="submit">{t.decks.form.create}</Button>
      </form>
    </Sheet>
  );
}
