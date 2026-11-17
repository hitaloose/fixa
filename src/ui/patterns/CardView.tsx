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
  /** Play the card's audio, one after another, once it is shown. */
  autoplay?: boolean;
}

function playInOrder([first, ...rest]: HTMLAudioElement[]): void {
  if (!first) return;
  first.addEventListener("ended", () => playInOrder(rest), { once: true });
  // Browsers may refuse autoplay before a user gesture; the controls stay available.
  void Promise.resolve(first.play()).catch(() => {});
}

/** Note type CSS may target `.card` like in Anki; `@scope` keeps it off the rest of the app. */
const scopeCss = (css: string) =>
  `@scope (.fixa-card) {\n${css.replace(/<\/style[^>]*>?/gi, "")}\n}`;

/** Displays one side of a card: sanitize → insert → KaTeX (docs/07-formulas.md). */
export function CardView({ html, css = "", resolveMedia, autoplay = false }: CardViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const resolve = useRef(resolveMedia);
  resolve.current = resolveMedia;
  const shouldPlay = useRef(autoplay);
  shouldPlay.current = autoplay;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = sanitizeFieldHtml(html);
    void renderMath(el);
    const resolver = resolve.current;
    let cancelled = false;
    const media = [...el.querySelectorAll<HTMLElement>("img[src], audio[src]")];
    const resolved = media.map(async (m) => {
      const url = await resolver?.(m.getAttribute("src") as string);
      if (url && !cancelled) m.setAttribute("src", url);
    });
    if (shouldPlay.current) {
      void Promise.all(resolved).then(() => {
        if (!cancelled) playInOrder([...el.querySelectorAll("audio")]);
      });
    }
    return () => {
      cancelled = true;
      // Detached audio keeps playing in some browsers: stop it when the card changes.
      for (const audio of el.querySelectorAll("audio")) audio.pause();
    };
  }, [html]);

  return (
    <div className="fixa-card card">
      {css && <style>{scopeCss(css)}</style>}
      <div ref={ref} data-testid="card-content" />
    </div>
  );
}
