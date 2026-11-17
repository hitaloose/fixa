import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import type { NoteType } from "../../../domain/model";
import {
  addField,
  addTemplate,
  moveField,
  NoteTypeEditError,
  removeField,
  removeTemplate,
  renameField,
} from "../../../domain/notetypes";
import { renderCard } from "../../../domain/templates";
import { t } from "../../../i18n/pt-BR";
import { Button, CardView, Icon, IconButton, Sheet, TextField, Toast } from "../../../ui";
import { useNoteType, useNoteTypeActions, useNoteTypeList } from "../hooks/useNoteTypes";

const m = t.noteTypes;

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-field border border-line bg-surface px-3"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        spellCheck={false}
        autoCapitalize="none"
        onChange={(e) => onChange(e.target.value)}
        className="rounded-field border border-line bg-surface px-3 py-2 font-mono text-sm"
      />
    </div>
  );
}

export function NoteTypesScreen() {
  const list = useNoteTypeList();
  const actions = useNoteTypeActions();
  const [creating, setCreating] = useState(false);
  const [base, setBase] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  if (!list) return null;

  const remove = async (id: string) => {
    setError(null);
    try {
      await actions.remove(id);
    } catch {
      setError(m.inUse);
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-4 pb-6">
      <header className="flex items-center justify-between gap-2">
        <h1 id={listId} className="font-display text-[28px] font-bold">
          {m.title}
        </h1>
        <Button
          onClick={() => {
            setBase(list[0]?.noteType.id ?? "");
            setName("");
            setCreating(true);
          }}
        >
          {m.create}
        </Button>
      </header>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ul
        aria-label={m.list}
        className="divide-y divide-line-soft overflow-hidden rounded-list border border-line bg-surface"
      >
        {list.map(({ noteType, notes }) => (
          <li key={noteType.id} className="flex items-center gap-2 pr-1">
            <Link
              to="/note-types/$noteTypeId"
              params={{ noteTypeId: noteType.id }}
              className="flex min-h-14 flex-1 flex-col justify-center px-4"
            >
              <span className="font-medium">{noteType.name}</span>
              <span className="text-xs text-muted">{m.notes(notes)}</span>
            </Link>
            <IconButton
              icon="close"
              label={m.remove(noteType.name)}
              onClick={() => void remove(noteType.id)}
              className="text-muted"
            />
          </li>
        ))}
      </ul>
      {creating ? (
        <Sheet
          open
          onOpenChange={(o) => !o && setCreating(false)}
          title={m.create}
          closeLabel={t.common.close}
        >
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              void actions.clone(base, name.trim()).then(() => setCreating(false));
            }}
          >
            <Select
              label={m.basedOn}
              value={base}
              onChange={setBase}
              options={list.map(({ noteType }) => ({ value: noteType.id, label: noteType.name }))}
            />
            <TextField label={m.name} value={name} onChange={setName} />
            <Button type="submit" disabled={!name.trim()}>
              {m.confirmCreate}
            </Button>
          </form>
        </Sheet>
      ) : null}
    </div>
  );
}

function FieldRow({
  index,
  name,
  first,
  last,
  onRename,
  onMove,
  onRemove,
}: {
  index: number;
  name: string;
  first: boolean;
  last: boolean;
  onRename: (name: string) => boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(name);
  const [prev, setPrev] = useState(name);
  if (prev !== name) {
    setPrev(name);
    setText(name);
  }
  return (
    <li className="flex items-end gap-1">
      <div className="flex-1">
        <TextField
          label={m.fieldName(index)}
          value={text}
          onChange={setText}
          onBlur={() => {
            if (text !== name && !onRename(text)) setText(name);
          }}
        />
      </div>
      <IconButton
        icon="chevronRight"
        label={m.moveUp(name)}
        disabled={first}
        onClick={() => onMove(-1)}
        className="-rotate-90 disabled:opacity-30"
      />
      <IconButton
        icon="chevronRight"
        label={m.moveDown(name)}
        disabled={last}
        onClick={() => onMove(1)}
        className="rotate-90 disabled:opacity-30"
      />
      <IconButton
        icon="close"
        label={m.removeField(name)}
        onClick={onRemove}
        className="text-muted"
      />
    </li>
  );
}

function Editor({ initial, onSaved }: { initial: NoteType; onSaved: () => void }) {
  const actions = useNoteTypeActions();
  const [draft, setDraft] = useState(initial);
  const [selected, setSelected] = useState(0);
  const [newField, setNewField] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const previewId = useId();

  const apply = (change: (nt: NoteType) => NoteType): boolean => {
    try {
      setDraft(change(draft));
      setError(null);
      return true;
    } catch (e) {
      if (e instanceof NoteTypeEditError) {
        setError(m.errors[e.code]);
        return false;
      }
      throw e;
    }
  };

  const template = draft.templates[selected] ?? draft.templates[0];
  const setTemplate = (patch: Partial<NonNullable<typeof template>>) =>
    setDraft((d) => ({
      ...d,
      templates: d.templates.map((tpl, i) => (i === selected ? { ...tpl, ...patch } : tpl)),
    }));
  const sample = { fields: Object.fromEntries(draft.fields.map((f) => [f.id, `(${f.name})`])) };
  const rendered = template
    ? renderCard({
        noteType: draft,
        note: sample,
        templateOrd: draft.kind === "cloze" ? 0 : selected,
      })
    : { front: "", back: "" };

  return (
    <div className="flex flex-col gap-4">
      <TextField
        label={m.typeName}
        value={draft.name}
        onChange={(name) => setDraft((d) => ({ ...d, name }))}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-2 rounded-section border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-muted">{m.fields}</h2>
        <ul className="flex flex-col gap-2">
          {draft.fields.map((f, i) => (
            <FieldRow
              key={f.id}
              index={i + 1}
              name={f.name}
              first={i === 0}
              last={i === draft.fields.length - 1}
              onRename={(name) => apply((nt) => renameField(nt, f.id, name))}
              onMove={(delta) => apply((nt) => moveField(nt, f.id, delta))}
              onRemove={() => apply((nt) => removeField(nt, f.id))}
            />
          ))}
        </ul>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextField label={m.newField} value={newField} onChange={setNewField} />
          </div>
          <Button
            variant="secondary"
            disabled={!newField.trim()}
            onClick={() => {
              if (apply((nt) => addField(nt, newField, actions.ids()))) setNewField("");
            }}
          >
            {m.addField}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-section border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-muted">{m.cards}</h2>
        <Select
          label={m.template}
          value={String(selected)}
          onChange={(v) => setSelected(Number(v))}
          options={draft.templates.map((tpl, i) => ({ value: String(i), label: tpl.name }))}
        />
        <div className="flex flex-wrap gap-2">
          {draft.kind === "standard" ? (
            <Button
              variant="secondary"
              onClick={() => {
                if (
                  apply((nt) =>
                    addTemplate(nt, t.seed.card(nt.templates.length + 1), actions.ids()),
                  )
                ) {
                  setSelected(draft.templates.length);
                }
              }}
            >
              {m.addTemplate}
            </Button>
          ) : null}
          {draft.templates.length > 1 && template ? (
            <Button
              variant="secondary"
              onClick={() => {
                if (apply((nt) => removeTemplate(nt, template.id))) setSelected(0);
              }}
            >
              {m.removeTemplate}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted">{m.templateHint}</p>
        {template ? (
          <>
            <TextArea
              label={m.front}
              value={template.front}
              onChange={(front) => setTemplate({ front })}
            />
            <TextArea
              label={m.back2}
              value={template.back}
              onChange={(back) => setTemplate({ back })}
            />
          </>
        ) : null}
        <TextArea
          label={m.css}
          value={draft.css}
          onChange={(css) => setDraft((d) => ({ ...d, css }))}
          rows={5}
        />
        <section aria-labelledby={previewId} className="rounded-list border border-line p-3">
          <h3 id={previewId} className="text-sm font-semibold">
            {m.preview}
          </h3>
          <p className="mt-2 text-xs text-muted">{m.previewFront}</p>
          <CardView html={rendered.front} css={draft.css} />
          <p className="mt-2 text-xs text-muted">{m.previewBack}</p>
          <CardView html={rendered.back} css={draft.css} />
        </section>
      </section>

      <Button
        className="min-h-14"
        disabled={!draft.name.trim()}
        onClick={() =>
          void actions.save({ ...draft, name: draft.name.trim() }).then(() => {
            setToast(m.saved);
            onSaved();
          })
        }
      >
        {m.save}
      </Button>
      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}

export function NoteTypeEditorScreen({
  noteTypeId,
  onSaved,
}: {
  noteTypeId: string;
  onSaved: () => void;
}) {
  const noteType = useNoteType(noteTypeId);
  if (noteType === undefined) return null;
  return (
    <div className="flex flex-col gap-4 pt-4 pb-6">
      <Link
        to="/note-types"
        aria-label={m.back}
        className="inline-flex size-11 items-center justify-center rounded-button text-ink"
      >
        <Icon name="chevronRight" className="size-6 rotate-180" />
      </Link>
      {noteType === null ? (
        <p className="text-muted">{m.notFound}</p>
      ) : (
        <>
          <h1 className="font-display text-[28px] font-bold">{noteType.name}</h1>
          <Editor key={noteType.id} initial={noteType} onSaved={onSaved} />
        </>
      )}
    </div>
  );
}
