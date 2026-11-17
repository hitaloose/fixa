/**
 * Tiptap always wraps text in <p>; Anki fields are inline HTML with <br> line breaks.
 * Top-level paragraphs become lines joined by <br>; other blocks (lists…) are kept as is.
 */
export function fromEditorHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  let out = "";
  let previousWasLine = false;
  for (const node of Array.from(template.content.childNodes)) {
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
