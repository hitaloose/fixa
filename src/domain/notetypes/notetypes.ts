/** Editing note types (custom fields and card templates). Pure: returns a new note type. */
import type { NoteType } from "../model";
import type { IdGenerator } from "../ports";

export type NoteTypeEditCode =
  | "invalid-name"
  | "name-taken"
  | "last-field"
  | "last-template"
  | "cloze-single-template";

export class NoteTypeEditError extends Error {
  constructor(readonly code: NoteTypeEditCode) {
    super(`note type edit refused: ${code}`);
    this.name = "NoteTypeEditError";
  }
}

const RESERVED = new Set(["FrontSide", "Tags", "Type", "Deck", "Subdeck", "Card", "CardFlag"]);

function checkName(nt: NoteType, name: string, exceptId?: string): string {
  const trimmed = name.trim();
  if (trimmed === "" || /[:{}#^/"]/.test(trimmed) || RESERVED.has(trimmed)) {
    throw new NoteTypeEditError("invalid-name");
  }
  if (nt.fields.some((f) => f.id !== exceptId && f.name === trimmed))
    throw new NoteTypeEditError("name-taken");
  return trimmed;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Renames a field and every {{…}} reference to it in the templates. */
export function renameField(nt: NoteType, fieldId: string, name: string): NoteType {
  const field = nt.fields.find((f) => f.id === fieldId);
  if (!field) return nt;
  const next = checkName(nt, name, fieldId);
  const reference = new RegExp(
    `\\{\\{\\s*([#^/]|(?:[\\w-]+:)*)\\s*${escapeRegExp(field.name)}\\s*\\}\\}`,
    "g",
  );
  const rewrite = (text: string) =>
    text.replace(reference, (_all, prefix: string) => `{{${prefix}${next}}}`);
  return {
    ...nt,
    fields: nt.fields.map((f) => (f.id === fieldId ? { ...f, name: next } : f)),
    templates: nt.templates.map((t) => ({ ...t, front: rewrite(t.front), back: rewrite(t.back) })),
  };
}

export function addField(nt: NoteType, name: string, ids: IdGenerator): NoteType {
  return {
    ...nt,
    fields: [
      ...nt.fields,
      { id: ids.next(), name: checkName(nt, name), sticky: false, rtl: false },
    ],
  };
}

export function removeField(nt: NoteType, fieldId: string): NoteType {
  if (nt.fields.length <= 1) throw new NoteTypeEditError("last-field");
  return { ...nt, fields: nt.fields.filter((f) => f.id !== fieldId) };
}

/** Moves a field one position up (-1) or down (+1); the first field sorts and dedupes notes. */
export function moveField(nt: NoteType, fieldId: string, delta: -1 | 1): NoteType {
  const from = nt.fields.findIndex((f) => f.id === fieldId);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= nt.fields.length) return nt;
  const fields = [...nt.fields];
  [fields[from], fields[to]] = [
    fields[to] as (typeof fields)[0],
    fields[from] as (typeof fields)[0],
  ];
  return { ...nt, fields };
}

export function addTemplate(nt: NoteType, name: string, ids: IdGenerator): NoteType {
  if (nt.kind === "cloze") throw new NoteTypeEditError("cloze-single-template");
  const first = nt.fields[0]?.name ?? "";
  return {
    ...nt,
    templates: [
      ...nt.templates,
      {
        id: ids.next(),
        name: name.trim() || name,
        front: `{{${first}}}`,
        back: "{{FrontSide}}<hr id=answer>",
      },
    ],
  };
}

export function removeTemplate(nt: NoteType, templateId: string): NoteType {
  if (nt.templates.length <= 1) throw new NoteTypeEditError("last-template");
  return { ...nt, templates: nt.templates.filter((t) => t.id !== templateId) };
}
