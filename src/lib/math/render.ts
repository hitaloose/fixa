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

const KATEX_OPTIONS = {
  throwOnError: false,
  errorColor: "var(--color-danger)",
  strict: "ignore",
  // Cloze deletions inside formulas are marked with \htmlClass{cloze}{…} (domain/templates).
  trust: (context: { command: string }) => context.command === "\\htmlClass",
} as const;

const OPTIONS: RenderMathInElementOptions = {
  delimiters: [
    { left: "\\(", right: "\\)", display: false },
    { left: "\\[", right: "\\]", display: true },
  ],
  ...KATEX_OPTIONS,
};

/** Renders the formulas inside an element that already holds sanitized card HTML. */
export async function renderMath(el: HTMLElement, load: () => Promise<MathRenderer> = loadKatex) {
  if (!hasMath(el.innerHTML)) return;
  const render = await load();
  render(el, OPTIONS);
}

/** Renders a single formula (no delimiters) into `el`, e.g. a math node in the editor. */
export async function renderLatex(el: HTMLElement, latex: string, display: boolean) {
  const [katex] = await Promise.all([import("katex"), import("katex/dist/katex.min.css")]);
  katex.default.render(latex, el, { ...KATEX_OPTIONS, displayMode: display });
}
