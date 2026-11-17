/**
 * CSV/TXT import (docs/08-import-export.md › .csv / .txt): delimited text with Anki's optional
 * "#key:value" header lines. Pure; the screen maps columns and the data layer writes notes.
 */
import type { Note, NoteType } from "../../model";
import { parseTags } from "../../notes";

export interface CsvDirectives {
  html?: boolean;
  deck?: string;
  notetype?: string;
  tags?: string[];
  columns?: string[];
  /** 0-based (the file says 1-based). */
  tagsColumn?: number;
  deckColumn?: number;
}

export interface DelimitedFile {
  separator: string;
  rows: string[][];
  directives: CsvDirectives;
}

const NAMED_SEPARATORS: Record<string, string> = {
  comma: ",",
  semicolon: ";",
  tab: "\t",
  space: " ",
  pipe: "|",
  colon: ":",
};

function detectSeparator(line: string): string {
  const counts = ["\t", ";", ","].map((sep) => [sep, line.split(sep).length - 1] as const);
  const [best] = [...counts].sort((a, b) => b[1] - a[1]);
  return best && best[1] > 0 ? best[0] : ",";
}

function splitRows(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let atCellStart = true;
  const endRow = () => {
    row.push(cell);
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
    cell = "";
    atCellStart = true;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
      continue;
    }
    if (c === '"' && atCellStart) {
      quoted = true;
      atCellStart = false;
    } else if (c === separator) {
      row.push(cell);
      cell = "";
      atCellStart = true;
    } else if (c === "\n") endRow();
    else if (c === "\r") continue;
    else {
      cell += c;
      atCellStart = false;
    }
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

export function parseDelimited(input: string): DelimitedFile {
  const text = input.replace(/^﻿/, "");
  const lines = text.split(/\r?\n/);
  const directives: CsvDirectives = {};
  let separator: string | undefined;
  let columns: string | undefined;
  let start = 0;
  for (; start < lines.length; start++) {
    const match = /^#([^:]+):(.*)$/.exec(lines[start] as string);
    if (!match) break;
    const key = (match[1] as string).trim().toLowerCase();
    const value = (match[2] as string).trim();
    if (key === "separator") separator = NAMED_SEPARATORS[value.toLowerCase()] ?? value;
    else if (key === "html") directives.html = value.toLowerCase() === "true";
    else if (key === "deck") directives.deck = value;
    else if (key === "notetype") directives.notetype = value;
    else if (key === "tags") directives.tags = parseTags(value);
    else if (key === "columns") columns = value;
    else if (key === "tags column") directives.tagsColumn = Number(value) - 1;
    else if (key === "deck column") directives.deckColumn = Number(value) - 1;
  }
  const body = lines.slice(start).join("\n");
  const sep = separator ?? detectSeparator(lines.slice(start).find((l) => l.trim() !== "") ?? "");
  if (columns !== undefined) directives.columns = columns.split(sep).map((c) => c.trim());
  return { separator: sep, rows: splitRows(body, sep), directives };
}

/** Where a column goes: a field id, the note's tags, or nowhere (null). */
export type CsvColumnTarget = string | "tags" | null;

export interface CsvNotesInput {
  rows: string[][];
  mapping: CsvColumnTarget[];
  noteType: NoteType;
  /** Cells are HTML; otherwise they are escaped and line breaks become <br>. */
  html: boolean;
  /** Tags added to every note (#tags:). */
  extraTags: string[];
}

const escapeText = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r?\n/g, "<br>");

export function planCsvNotes({
  rows,
  mapping,
  noteType,
  html,
  extraTags,
}: CsvNotesInput): Array<Pick<Note, "fields" | "tags">> {
  return rows.map((row) => {
    const fields: Note["fields"] = Object.fromEntries(noteType.fields.map((f) => [f.id, ""]));
    let tags: string[] = [];
    mapping.forEach((target, i) => {
      const value = row[i] ?? "";
      if (target === "tags") tags = [...tags, ...parseTags(value)];
      else if (target !== null && target in fields)
        fields[target] = html ? value : escapeText(value);
    });
    return { fields, tags: [...new Set([...tags, ...extraTags])] };
  });
}
