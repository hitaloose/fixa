/**
 * Formula display with KaTeX (docs/07-formulas.md). KaTeX and its CSS are loaded on demand,
 * only when the card actually contains \(...\) or \[...\].
 */
import type { RenderMathInElementOptions } from "katex/contrib/auto-render";

export type MathRenderer = (el: HTMLElement, options: RenderMathInElementOptions) => void;

const DELIMITERS = /\\\(|\\\[/;

export const hasMath = (html: string) => DELIMITERS.test(html);

export async function loadKatex(): Promise<MathRenderer> {
  const [autoRender] = await Promise.all([
    import("katex/contrib/auto-render"),
    import("katex/dist/katex.min.css"),
  ]);
  return autoRender.default;
}

const OPTIONS: RenderMathInElementOptions = {
  delimiters: [
    { left: "\\(", right: "\\)", display: false },
    { left: "\\[", right: "\\]", display: true },
  ],
  throwOnError: false,
  errorColor: "var(--color-danger)",
  strict: "ignore",
  // Cloze deletions inside formulas are marked with \htmlClass{cloze}{…} (domain/templates).
  trust: (context) => context.command === "\\htmlClass",
};

/** Renders the formulas inside an element that already holds sanitized card HTML. */
export async function renderMath(el: HTMLElement, load: () => Promise<MathRenderer> = loadKatex) {
  if (!hasMath(el.innerHTML)) return;
  const render = await load();
  render(el, OPTIONS);
}
