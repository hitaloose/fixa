import { useLayoutEffect, useRef } from "react";
import { renderMath } from "../../lib/math/render";
import { sanitizeFieldHtml } from "../../lib/sanitize";

export interface CardViewProps {
  /** Rendered template HTML (domain/templates); sanitized here before display. */
  html: string;
  /** The note type's CSS, applied only inside this card. */
  css?: string;
}

/** Note type CSS may target `.card` like in Anki; `@scope` keeps it off the rest of the app. */
const scopeCss = (css: string) =>
  `@scope (.fixa-card) {\n${css.replace(/<\/style[^>]*>?/gi, "")}\n}`;

/** Displays one side of a card: sanitize → insert → KaTeX (docs/07-formulas.md). */
export function CardView({ html, css = "" }: CardViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = sanitizeFieldHtml(html);
    void renderMath(el);
  }, [html]);

  return (
    <div className="fixa-card card">
      {css && <style>{scopeCss(css)}</style>}
      <div ref={ref} data-testid="card-content" />
    </div>
  );
}
