import { useLayoutEffect, useRef } from "react";
import { renderMath } from "../../lib/math/render";
import { sanitizeFieldHtml } from "../../lib/sanitize";

export interface CardViewProps {
  /** Rendered template HTML (domain/templates); sanitized here before display. */
  html: string;
  /** The note type's CSS, applied only inside this card. */
  css?: string;
  /** Display URL (blob:) for a media file name referenced by the HTML. */
  resolveMedia?: (fileName: string) => Promise<string | undefined>;
}

/** Note type CSS may target `.card` like in Anki; `@scope` keeps it off the rest of the app. */
const scopeCss = (css: string) =>
  `@scope (.fixa-card) {\n${css.replace(/<\/style[^>]*>?/gi, "")}\n}`;

/** Displays one side of a card: sanitize → insert → KaTeX (docs/07-formulas.md). */
export function CardView({ html, css = "", resolveMedia }: CardViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const resolve = useRef(resolveMedia);
  resolve.current = resolveMedia;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = sanitizeFieldHtml(html);
    void renderMath(el);
    const resolver = resolve.current;
    if (!resolver) return;
    for (const media of el.querySelectorAll<HTMLElement>("img[src], audio[src]")) {
      const name = media.getAttribute("src") as string;
      void resolver(name).then((url) => {
        if (url) media.setAttribute("src", url);
      });
    }
  }, [html]);

  return (
    <div className="fixa-card card">
      {css && <style>{scopeCss(css)}</style>}
      <div ref={ref} data-testid="card-content" />
    </div>
  );
}
