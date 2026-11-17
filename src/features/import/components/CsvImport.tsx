import { useId, useMemo, useState } from "react";
import type { DuplicatePolicy } from "../../../data/repositories";
import { type CsvColumnTarget, type DelimitedFile, planCsvNotes } from "../../../domain/import/csv";
import { plainText } from "../../../domain/notes";
import { t } from "../../../i18n/pt-BR";
import { Button, Switch } from "../../../ui";
import { useCsvImport, useImportTargets } from "../hooks/useCsvImport";

const c = t.importer.csv;
const norm = (s: string) => s.trim().toLocaleLowerCase("pt-BR");

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

const IGNORE = "__ignore";
const TAGS = "__tags";

export function CsvImport({
  file,
  onDone,
}: {
  file: DelimitedFile;
  onDone: (message: string) => void;
}) {
  const targets = useImportTargets();
  if (!targets) return null;
  if (targets.decks.length === 0 || targets.noteTypes.length === 0) {
    return <p className="text-muted">{c.noDecks}</p>;
  }
  return <CsvForm file={file} targets={targets} onDone={onDone} />;
}

function CsvForm({
  file,
  targets,
  onDone,
}: {
  file: DelimitedFile;
  targets: NonNullable<ReturnType<typeof useImportTargets>>;
  onDone: (message: string) => void;
}) {
  const importNotes = useCsvImport();
  const { directives } = file;
  const byName = <T extends { name: string }>(items: T[], name?: string) =>
    name ? items.find((i) => norm(i.name) === norm(name)) : undefined;
  const [noteTypeId, setNoteTypeId] = useState(
    () => (byName(targets.noteTypes, directives.notetype) ?? targets.noteTypes[0])?.id ?? "",
  );
  const [deckId, setDeckId] = useState(
    () =>
      targets.decks.find((d) => directives.deck && norm(d.path) === norm(directives.deck))?.id ??
      targets.decks[0]?.id ??
      "",
  );
  const [header, setHeader] = useState(false);
  const [html, setHtml] = useState(directives.html ?? false);
  const [duplicates, setDuplicates] = useState<DuplicatePolicy>("skip");
  const noteType = targets.noteTypes.find((nt) => nt.id === noteTypeId) ?? targets.noteTypes[0];
  const width = Math.max(0, ...file.rows.map((r) => r.length));
  const names = directives.columns ?? (header ? (file.rows[0] ?? []) : []);
  const dataRows = header && !directives.columns ? file.rows.slice(1) : file.rows;
  const columnLabel = (i: number) => names[i]?.trim() || c.column(i + 1);

  /** By column name when there is one, else by position; the #tags column goes to tags. */
  const defaultMapping = (): string[] =>
    Array.from({ length: width }, (_, i) => {
      if (i === directives.tagsColumn) return TAGS;
      const named = names[i] ? byName(noteType?.fields ?? [], names[i]) : undefined;
      if (named) return named.id;
      if (names.length > 0) return IGNORE;
      return noteType?.fields[i]?.id ?? IGNORE;
    });
  const [mapping, setMapping] = useState<string[]>(defaultMapping);
  const [mappingKey, setMappingKey] = useState(`${noteTypeId}:${header}`);
  if (mappingKey !== `${noteTypeId}:${header}`) {
    setMappingKey(`${noteTypeId}:${header}`);
    setMapping(defaultMapping());
  }

  const targetsFor = (): CsvColumnTarget[] =>
    mapping.map((m) => (m === IGNORE ? null : m === TAGS ? "tags" : m));
  const notes = useMemo(
    () =>
      noteType
        ? planCsvNotes({
            rows: dataRows,
            mapping: targetsFor(),
            noteType,
            html,
            extraTags: directives.tags ?? [],
          })
        : [],
    // biome-ignore lint/correctness/useExhaustiveDependencies: derived from the form state listed
    [dataRows, noteType, html, directives.tags, targetsFor],
  );

  if (!noteType) return null;
  const fieldOptions = [
    ...noteType.fields.map((f) => ({ value: f.id, label: f.name })),
    { value: TAGS, label: c.tags },
    { value: IGNORE, label: c.ignore },
  ];

  const submit = async () => {
    const summary = await importNotes({ noteTypeId: noteType.id, deckId, notes, duplicates });
    onDone(c.done(summary));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={c.noteType}
          value={noteType.id}
          onChange={setNoteTypeId}
          options={targets.noteTypes.map((nt) => ({ value: nt.id, label: nt.name }))}
        />
        <Select
          label={c.deck}
          value={deckId}
          onChange={setDeckId}
          options={targets.decks.map((d) => ({ value: d.id, label: d.path }))}
        />
      </div>
      <div className="flex flex-col divide-y divide-line-soft rounded-list border border-line bg-surface px-3">
        {directives.columns ? null : (
          <Switch label={c.header} checked={header} onChange={setHeader} />
        )}
        <Switch label={c.html} checked={html} onChange={setHtml} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: width }, (_, i) => (
          <Select
            // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
            key={i}
            label={columnLabel(i)}
            value={mapping[i] ?? IGNORE}
            onChange={(v) => setMapping((m) => m.map((x, j) => (j === i ? v : x)))}
            options={fieldOptions}
          />
        ))}
      </div>
      <div className="overflow-x-auto rounded-list border border-line bg-surface">
        <table aria-label={c.preview} className="w-full text-left text-sm">
          <thead>
            <tr>
              {noteType.fields.map((f) => (
                <th key={f.id} scope="col" className="px-3 py-2 font-semibold">
                  {f.name}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 font-semibold">
                {c.tags}
              </th>
            </tr>
          </thead>
          <tbody>
            {notes.slice(0, 5).map((n, r) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: preview rows are positional
              <tr key={r} className="border-t border-line-soft">
                {noteType.fields.map((f) => (
                  <td key={f.id} className="max-w-48 truncate px-3 py-2">
                    {plainText(n.fields[f.id] ?? "")}
                  </td>
                ))}
                <td className="px-3 py-2">{n.tags.join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Select
        label={c.duplicates}
        value={duplicates}
        onChange={(v) => setDuplicates(v as DuplicatePolicy)}
        options={(Object.keys(c.policies) as DuplicatePolicy[]).map((p) => ({
          value: p,
          label: c.policies[p],
        }))}
      />
      <Button onClick={() => void submit()} className="min-h-14" disabled={!deckId}>
        {c.importRows(notes.length)}
      </Button>
    </div>
  );
}
