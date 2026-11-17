/**
 * Conversion between stored field HTML (Anki style) and the editor's HTML (Tiptap).
 *
 * - Tiptap always wraps text in <p>; Anki fields are inline HTML with <br> line breaks.
 * - Formulas are stored as text with \(…\) / \[…\] delimiters (docs/07-formulas.md); in the
 *   editor they are `math` nodes, written as <span data-math data-latex>.
 */

const MATH = /\\\((.+?)\\\)|\\\[(.+?)\\\]/gs;

function parse(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}

function serialize(fragment: DocumentFragment): string {
  const holder = document.createElement("div");
  holder.append(fragment);
  return holder.innerHTML;
}

function mathSpan(latex: string, display: boolean): HTMLSpanElement {
  const span = document.createElement("span");
  span.dataset.math = display ? "display" : "inline";
  span.dataset.latex = latex;
  return span;
}

/** Stored field HTML → editor HTML: formula delimiters become math nodes. */
export function toEditorHtml(html: string): string {
  const content = parse(html);
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const text of texts) {
    const value = text.data;
    const parts: Node[] = [];
    let last = 0;
    for (const m of value.matchAll(MATH)) {
      if (m.index > last) parts.push(document.createTextNode(value.slice(last, m.index)));
      parts.push(m[1] !== undefined ? mathSpan(m[1], false) : mathSpan(m[2] as string, true));
      last = m.index + m[0].length;
    }
    if (parts.length === 0) continue;
    if (last < value.length) parts.push(document.createTextNode(value.slice(last)));
    text.replaceWith(...parts);
  }
  return serialize(content);
}

/**
 * Editor HTML → stored field HTML: math nodes go back to delimited LaTeX, top-level
 * paragraphs become lines joined by <br>, other blocks (lists…) are kept as they are.
 */
export function fromEditorHtml(html: string): string {
  const content = parse(html);
  for (const span of content.querySelectorAll<HTMLElement>("span[data-math]")) {
    const latex = span.dataset.latex ?? "";
    const [open, close] = span.dataset.math === "display" ? ["\\[", "\\]"] : ["\\(", "\\)"];
    span.replaceWith(document.createTextNode(`${open}${latex}${close}`));
  }
  let out = "";
  let previousWasLine = false;
  for (const node of Array.from(content.childNodes)) {
    const isLine = node instanceof HTMLParagraphElement;
    if (isLine && previousWasLine) out += "<br>";
    out += isLine
      ? node.innerHTML
      : node instanceof Element
        ? node.outerHTML
        : (node.textContent ?? "");
    previousWasLine = isLine;
  }
  return out;
}
