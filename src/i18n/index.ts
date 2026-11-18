import { en } from "./en";
import { type Messages, t as ptBR } from "./pt-BR";

export type { Messages };
export type Locale = "pt-BR" | "en";
export const LOCALES: readonly Locale[] = ["pt-BR", "en"];

const CATALOGS: Record<Locale, Messages> = { "pt-BR": ptBR, en };

/**
 * The active messages. A live binding: modules that read `t` after setLocale()
 * see the new locale. Some modules capture `t.x` at load, so the locale is set
 * once at startup, before the routes load (src/main.tsx), and changing it reloads.
 */
export let t: Messages = ptBR;

export function setLocale(locale: Locale): void {
  t = CATALOGS[locale];
}
