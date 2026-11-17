/**
 * Cloze deletions ({{c1::answer::hint}}), Anki-compatible, including clozes inside
 * \(...\) / \[...\] formulas (docs/07-formulas.md): there the hidden part is written as LaTeX,
 * because KaTeX runs after templating and cannot contain HTML.
 */

export type Side = "front" | "back";

interface Cloze {
  n: number;
  answer: Segment[];
  hint: string | null;
}
type Segment = string | Cloze;

const OPEN = /\{\{c([1-9]\d*)::/y;

/** Index of the "}}" that closes a cloze body starting at `from`, honouring nested braces. */
function findClose(s: string, from: number): number {
  let depth = 0;
  for (let j = from; j < s.length; j++) {
    if (depth === 0 && s.startsWith("}}", j)) return j;
    if (s[j] === "{") depth++;
    else if (s[j] === "}") depth--;
  }
  return s.indexOf("}}", from);
}

/** Index of the first "::" outside braces, or -1. */
function findHintSeparator(body: string): number {
  let depth = 0;
  for (let j = 0; j < body.length; j++) {
    if (depth === 0 && body.startsWith("::", j)) return j;
    if (body[j] === "{") depth++;
    else if (body[j] === "}") depth--;
  }
  return -1;
}

function parse(s: string): Segment[] {
  const out: Segment[] = [];
  let text = "";
  let i = 0;
  while (i < s.length) {
    OPEN.lastIndex = i;
    const open = OPEN.exec(s);
    const close = open ? findClose(s, OPEN.lastIndex) : -1;
    if (!open || close === -1) {
      text += s[i];
      i++;
      continue;
    }
    out.push(text);
    text = "";
    const body = s.slice(OPEN.lastIndex, close);
    const sep = findHintSeparator(body);
    out.push({
      n: Number(open[1]),
      answer: parse(sep === -1 ? body : body.slice(0, sep)),
      hint: sep === -1 ? null : body.slice(sep + 2),
    });
    i = close + 2;
  }
  out.push(text);
  return out;
}

function collect(segments: Segment[], into: Set<number>): void {
  for (const seg of segments) {
    if (typeof seg === "string") continue;
    into.add(seg.n);
    collect(seg.answer, into);
  }
}

/** Distinct cloze numbers in the text, ascending. */
export function clozeNumbers(html: string): number[] {
  const found = new Set<number>();
  collect(parse(html), found);
  return [...found].sort((a, b) => a - b);
}

const TEX_TEXT_ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "#": "\\#",
  "%": "\\%",
  _: "\\_",
  "^": "\\textasciicircum{}",
  "~": "\\textasciitilde{}",
};
const escapeTexText = (s: string) => s.replace(/[\\{}$&#%_^~]/g, (c) => TEX_TEXT_ESCAPES[c] ?? c);

/** Tracks whether the end of `text` is inside a formula, given the state at its start. */
function mathStateAfter(text: string, inMath: boolean): boolean {
  let state = inMath;
  for (const m of text.matchAll(/\\[()[\]]/g)) state = m[0] === "\\(" || m[0] === "\\[";
  return state;
}

function render(segments: Segment[], n: number, side: Side, startInMath: boolean): string {
  let inMath = startInMath;
  let out = "";
  for (const seg of segments) {
    if (typeof seg === "string") {
      out += seg;
      inMath = mathStateAfter(seg, inMath);
      continue;
    }
    const answer = render(seg.answer, n, side, inMath);
    if (seg.n !== n) out += answer;
    else if (inMath) {
      const shown =
        side === "back"
          ? answer
          : `[${seg.hint === null ? "\\dots" : `\\text{${escapeTexText(seg.hint)}}`}]`;
      out += `\\htmlClass{cloze}{${shown}}`;
    } else {
      const shown = side === "back" ? answer : `[${seg.hint ?? "…"}]`;
      out += `<span class="cloze">${shown}</span>`;
    }
  }
  return out;
}

/** Renders cloze number `n` for one side; other clozes show their answer as plain text. */
export function renderCloze(html: string, n: number, side: Side): string {
  return render(parse(html), n, side, false);
}
