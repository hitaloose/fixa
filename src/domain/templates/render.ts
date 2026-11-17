/**
 * Anki-style card templates: {{Field}}, {{FrontSide}}, {{#Field}}…{{/Field}},
 * {{^Field}}…{{/Field}} and filters ({{text:Field}}, {{cloze:Field}}). Pure string → string;
 * the result is sanitized and math-rendered by the UI.
 */
import type { Note, NoteType } from "../model";
import { clozeNumbers, renderCloze, type Side } from "./cloze";

type Node =
  | { t: "text"; v: string }
  | { t: "field"; name: string; filters: string[] }
  | { t: "section"; name: string; inverted: boolean; children: Node[] };

const TAG = /\{\{([^{}]+)\}\}/g;

function parseTemplate(template: string): Node[] {
  const root: Node[] = [];
  const stack: Array<{ name: string; children: Node[] }> = [{ name: "", children: root }];
  const top = () => stack[stack.length - 1] as { name: string; children: Node[] };
  let last = 0;
  for (const m of template.matchAll(TAG)) {
    top().children.push({ t: "text", v: template.slice(last, m.index) });
    last = m.index + m[0].length;
    const tag = (m[1] as string).trim();
    const marker = tag[0];
    const name = tag.slice(1).trim();
    if (marker === "#" || marker === "^") {
      const section: Node = { t: "section", name, inverted: marker === "^", children: [] };
      top().children.push(section);
      stack.push(section);
    } else if (marker === "/") {
      if (stack.length > 1 && top().name === name) stack.pop();
    } else {
      const parts = tag.split(":").map((p) => p.trim());
      top().children.push({ t: "field", name: parts.pop() as string, filters: parts });
    }
  }
  top().children.push({ t: "text", v: template.slice(last) });
  return root;
}

const EMPTY_MARKUP = /<br\s*\/?>|<\/?(?:div|p)\b[^>]*>|&nbsp;|[\s​]/gi;

/** A field counts as empty when it holds only whitespace, line breaks and empty blocks. */
export function isFieldEmpty(html: string): boolean {
  return html.replace(EMPTY_MARKUP, "") === "";
}

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "");

interface Context {
  fields: Map<string, string>;
  frontSide: string;
  cloze: { n: number; side: Side } | null;
}

function applyFilter(filter: string, value: string, ctx: Context): string {
  if (filter === "text") return stripHtml(value);
  if (filter === "cloze" && ctx.cloze) return renderCloze(value, ctx.cloze.n, ctx.cloze.side);
  return value;
}

/** Renders nodes; `used` reports whether any non-empty field content was output. */
function renderNodes(nodes: Node[], ctx: Context): { html: string; used: boolean } {
  let html = "";
  let used = false;
  for (const node of nodes) {
    if (node.t === "text") html += node.v;
    else if (node.t === "field") {
      const value = node.name === "FrontSide" ? ctx.frontSide : (ctx.fields.get(node.name) ?? "");
      if (!isFieldEmpty(value)) used = true;
      html += node.filters.reduceRight((v, f) => applyFilter(f, v, ctx), value);
    } else if (isFieldEmpty(ctx.fields.get(node.name) ?? "") === node.inverted) {
      const inner = renderNodes(node.children, ctx);
      html += inner.html;
      used ||= inner.used;
    }
  }
  return { html, used };
}

function fieldsByName(noteType: NoteType, note: Note): Map<string, string> {
  return new Map(noteType.fields.map((f) => [f.name, note.fields[f.id] ?? ""]));
}

function templateFor(noteType: NoteType, templateOrd: number) {
  const template =
    templateOrd >= 0 ? noteType.templates[noteType.kind === "cloze" ? 0 : templateOrd] : undefined;
  if (!template) throw new RangeError(`template ${templateOrd} does not exist`);
  return template;
}

export interface RenderInput {
  noteType: NoteType;
  note: Note;
  /** Template index; for cloze note types, the cloze number − 1. */
  templateOrd: number;
}

export interface RenderedCard {
  front: string;
  back: string;
}

export function renderCard({ noteType, note, templateOrd }: RenderInput): RenderedCard {
  const template = templateFor(noteType, templateOrd);
  const fields = fieldsByName(noteType, note);
  const clozeFor = (side: Side) =>
    noteType.kind === "cloze" ? { n: templateOrd + 1, side } : null;
  const front = renderNodes(parseTemplate(template.front), {
    fields,
    frontSide: "",
    cloze: clozeFor("front"),
  }).html;
  const back = renderNodes(parseTemplate(template.back), {
    fields,
    frontSide: front,
    cloze: clozeFor("back"),
  }).html;
  return { front, back };
}

function clozeFieldNames(nodes: Node[]): string[] {
  return nodes.flatMap((n) => {
    if (n.t === "field") return n.filters.includes("cloze") ? [n.name] : [];
    if (n.t === "section") return clozeFieldNames(n.children);
    return [];
  });
}

/**
 * Which cards a note has (their templateOrd): for standard types, each template whose front
 * shows some non-empty field; for cloze types, one per cloze number in the cloze field(s).
 */
export function generateCards(noteType: NoteType, note: Note): number[] {
  const fields = fieldsByName(noteType, note);
  if (noteType.kind === "cloze") {
    const template = templateFor(noteType, 0);
    const numbers = new Set(
      clozeFieldNames(parseTemplate(template.front)).flatMap((name) =>
        clozeNumbers(fields.get(name) ?? ""),
      ),
    );
    return [...numbers].sort((a, b) => a - b).map((n) => n - 1);
  }
  return noteType.templates.flatMap((template, ord) =>
    renderNodes(parseTemplate(template.front), { fields, frontSide: "", cloze: null }).used
      ? [ord]
      : [],
  );
}
