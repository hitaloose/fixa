import { Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useId, useState } from "react";
import type { Note, NoteType } from "../../../domain/model";
import { nextClozeNumber, parseTags } from "../../../domain/notes";
import { generateCards, renderCard } from "../../../domain/templates";
import { t } from "../../../i18n";
import { Button, CardView, IconButton, Select as SelectInput, Sheet, TextField } from "../../../ui";
import { type DeckOption, useEditorData } from "../hooks/useEditorData";
import { useMedia } from "../hooks/useMedia";
import { useNote, useRecentlyAdded } from "../hooks/useNote";
import { type NoteActionError, useNoteActions } from "../hooks/useNoteActions";
import { FieldEditor } from "./FieldEditor";

type Fields = Note["fields"];

interface Draft {
  noteTypeId: string;
  deckId: string;
  fields: Fields;
  tags: string;
}

const emptyFields = (noteType: NoteType): Fields =>
  Object.fromEntries(noteType.fields.map((f) => [f.id, ""]));

/** Carries contents over by field position, like Anki does when the note type changes. */
function remapFields(from: NoteType, to: NoteType, fields: Fields): Fields {
  return Object.fromEntries(
    to.fields.map((f, i) => [f.id, fields[from.fields[i]?.id ?? ""] ?? ""]),
  );
}

function errorMessage(code: NoteActionError, noteType: NoteType): string {
  if (code === "not-found") return t.editor.notFound;
  return noteType.kind === "cloze" ? t.editor.errors.noCloze : t.editor.errors.emptyFront;
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <SelectInput id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectInput>
    </div>
  );
}

function PreviewSheet({
  open,
  onOpenChange,
  noteType,
  fields,
  resolveMedia,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteType: NoteType;
  fields: Fields;
  resolveMedia: (fileName: string) => Promise<string | undefined>;
}) {
  const ords = generateCards(noteType, { fields });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t.editor.previewTitle}
      closeLabel={t.common.close}
    >
      {ords.length === 0 ? (
        <p className="text-muted">{t.editor.noPreview}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {ords.map((ord) => {
            const card = renderCard({ noteType, note: { fields }, templateOrd: ord });
            const name =
              noteType.kind === "cloze"
                ? t.editor.clozeCard(ord + 1)
                : (noteType.templates[ord]?.name ?? "");
            return (
              <PreviewCard
                key={ord}
                name={name}
                front={card.front}
                back={card.back}
                css={noteType.css}
                resolveMedia={resolveMedia}
              />
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

function PreviewCard(props: {
  name: string;
  front: string;
  back: string;
  css: string;
  resolveMedia: (fileName: string) => Promise<string | undefined>;
}) {
  const id = useId();
  return (
    <article aria-labelledby={id} className="rounded-list border border-line p-3">
      <h3 id={id} className="font-semibold">
        {props.name}
      </h3>
      <p className="mt-2 text-xs text-muted">{t.editor.front}</p>
      <CardView html={props.front} css={props.css} resolveMedia={props.resolveMedia} />
      <p className="mt-2 text-xs text-muted">{t.editor.back}</p>
      <CardView html={props.back} css={props.css} resolveMedia={props.resolveMedia} />
    </article>
  );
}

function HistorySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const notes = useRecentlyAdded(open);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t.editor.historyTitle}
      closeLabel={t.common.close}
    >
      {notes && notes.length === 0 ? <p className="text-muted">{t.editor.historyEmpty}</p> : null}
      <ul className="flex flex-col">
        {notes?.map((n) => (
          <li key={n.id}>
            <Link
              to="/notes/$noteId/edit"
              params={{ noteId: n.id }}
              className="flex min-h-11 items-center border-b border-line-soft"
            >
              {n.sortField || t.editor.untitled}
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

interface NoteFormProps {
  title: string;
  noteTypes: NoteType[];
  /** Deck choice (add mode only). */
  decks?: DeckOption[];
  initial: Draft;
  submitLabel: string;
  /** Note being edited: excluded from the duplicate check, and the note type is fixed. */
  noteId?: string;
  headerAction?: React.ReactNode;
  onSubmit: (draft: {
    noteType: NoteType;
    deckId: string;
    fields: Fields;
    tags: string[];
  }) => Promise<NoteActionError | null>;
  onSuccess: (noteType: NoteType, draft: Draft) => Draft;
  successMessage: string | null;
}

function NoteForm({
  title,
  noteTypes,
  decks,
  initial,
  submitLabel,
  noteId,
  headerAction,
  onSubmit,
  onSuccess,
  successMessage,
}: NoteFormProps) {
  const actions = useNoteActions();
  const media = useMedia();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const noteType = noteTypes.find((nt) => nt.id === draft.noteTypeId) ?? noteTypes[0];
  const firstFieldId = noteType?.fields[0]?.id ?? "";
  const firstField = draft.fields[firstFieldId] ?? "";

  useEffect(() => {
    let cancelled = false;
    // A check outlived by the screen (e.g. after saving) is dropped, including its failure.
    void actions.hasDuplicate(draft.noteTypeId, firstField, noteId).then(
      (found) => {
        if (!cancelled) setDuplicate(found);
      },
      (error: unknown) => {
        if (!cancelled) throw error;
      },
    );
    return () => {
      cancelled = true;
    };
  }, [draft.noteTypeId, firstField, noteId, actions.hasDuplicate]);

  if (!noteType) return null;

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
    setStatus(null);
  };

  const changeType = (id: string) => {
    const next = noteTypes.find((nt) => nt.id === id);
    if (!next) return;
    update({ noteTypeId: id, fields: remapFields(noteType, next, draft.fields) });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const code = await onSubmit({
      noteType,
      deckId: draft.deckId,
      fields: draft.fields,
      tags: parseTags(draft.tags),
    });
    if (code) {
      setError(errorMessage(code, noteType));
      return;
    }
    setDraft(onSuccess(noteType, draft));
    setStatus(successMessage);
  };

  const clozeNumber =
    noteType.kind === "cloze" ? nextClozeNumber(Object.values(draft.fields)) : undefined;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-4 pb-6" noValidate>
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[28px] font-bold">{title}</h1>
        {headerAction}
      </header>

      {noteId === undefined ? (
        <Select
          label={t.editor.noteType}
          value={noteType.id}
          onChange={changeType}
          options={noteTypes.map((nt) => ({ value: nt.id, label: nt.name }))}
        />
      ) : null}
      {decks ? (
        <Select
          label={t.editor.deck}
          value={draft.deckId}
          onChange={(deckId) => update({ deckId })}
          options={decks.map((d) => ({ value: d.id, label: d.path }))}
        />
      ) : null}

      {noteType.fields.map((field, i) => (
        <div key={`${noteType.id}:${field.id}`} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{field.name}</span>
            {noteId === undefined ? (
              <IconButton
                icon="pin"
                label={t.editor.pin(field.name)}
                aria-pressed={field.sticky}
                onClick={() => void actions.setSticky(noteType, field.id, !field.sticky)}
                className="aria-pressed:text-primary text-faint"
              />
            ) : null}
          </div>
          <FieldEditor
            label={field.name}
            value={draft.fields[field.id] ?? ""}
            onChange={(html) => update({ fields: { ...draft.fields, [field.id]: html } })}
            storeMedia={media.store}
            resolveMedia={media.resolve}
            {...(clozeNumber === undefined ? {} : { nextCloze: clozeNumber })}
          />
          {i === 0 && duplicate ? (
            <p className="text-xs text-learning-ink">{t.editor.duplicate}</p>
          ) : null}
        </div>
      ))}

      <TextField
        label={t.editor.tags}
        hint={t.editor.tagsHint}
        value={draft.tags}
        onChange={(tags) => update({ tags })}
        autoCapitalize="none"
      />

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-review-ink">
          {status}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setPreviewOpen(true)} className="flex-1">
          {t.editor.preview}
        </Button>
        <Button type="submit" className="flex-1">
          {submitLabel}
        </Button>
      </div>

      {previewOpen ? (
        <PreviewSheet
          open
          onOpenChange={setPreviewOpen}
          noteType={noteType}
          fields={draft.fields}
          resolveMedia={media.resolve}
        />
      ) : null}
    </form>
  );
}

export function AddNoteScreen({ deckId }: { deckId?: string }) {
  const data = useEditorData();
  const actions = useNoteActions();
  const [historyOpen, setHistoryOpen] = useState(false);
  if (!data) return null;

  const firstDeck = data.decks.find((d) => d.id === deckId) ?? data.decks[0];
  const firstType = data.noteTypes[0];
  if (!firstDeck || !firstType) {
    return (
      <div className="flex flex-col gap-3 pt-4">
        <h1 className="font-display text-[28px] font-bold">{t.editor.addTitle}</h1>
        <p className="text-muted">{t.editor.noDecks}</p>
        <Link to="/" className="min-h-11 font-semibold text-primary">
          {t.editor.goToDecks}
        </Link>
      </div>
    );
  }

  return (
    <>
      <NoteForm
        title={t.editor.addTitle}
        noteTypes={data.noteTypes}
        decks={data.decks}
        initial={{
          noteTypeId: firstType.id,
          deckId: firstDeck.id,
          fields: emptyFields(firstType),
          tags: "",
        }}
        submitLabel={t.editor.add}
        headerAction={
          <IconButton
            icon="history"
            label={t.editor.history}
            onClick={() => setHistoryOpen(true)}
          />
        }
        onSubmit={({ noteType, deckId: target, fields, tags }) =>
          actions.add({ noteTypeId: noteType.id, deckId: target, fields, tags })
        }
        onSuccess={(noteType, draft) => ({
          ...draft,
          fields: Object.fromEntries(
            noteType.fields.map((f) => [f.id, f.sticky ? (draft.fields[f.id] ?? "") : ""]),
          ),
        })}
        successMessage={t.editor.added}
      />
      {historyOpen ? <HistorySheet open onOpenChange={setHistoryOpen} /> : null}
    </>
  );
}

export function EditNoteScreen({ noteId, onSaved }: { noteId: string; onSaved: () => void }) {
  const data = useEditorData();
  const note = useNote(noteId);
  const actions = useNoteActions();
  if (!data || note === undefined) return null;
  if (note === null) {
    return (
      <div className="flex flex-col gap-3 pt-4">
        <h1 className="font-display text-[28px] font-bold">{t.editor.editTitle}</h1>
        <p className="text-muted">{t.editor.notFound}</p>
      </div>
    );
  }
  return (
    <NoteForm
      key={note.id}
      title={t.editor.editTitle}
      noteTypes={data.noteTypes}
      noteId={note.id}
      initial={{
        noteTypeId: note.noteTypeId,
        deckId: "",
        fields: note.fields,
        tags: note.tags.join(" "),
      }}
      submitLabel={t.editor.save}
      onSubmit={({ fields, tags }) => actions.edit(note.id, { fields, tags })}
      onSuccess={(_nt, draft) => {
        onSaved();
        return draft;
      }}
      successMessage={t.editor.saved}
    />
  );
}
