export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

/** Matches the page backgrounds in theme.css (browser UI / status bar colour). */
const THEME_COLOR: Record<Theme, string> = { light: "#f5f3ee", dark: "#111215" };

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: Pick<MediaQueryList, "matches">,
): Theme {
  if (preference === "system") return prefersDark.matches ? "dark" : "light";
  return preference;
}

/** Applies the theme to the document: tokens switch on [data-theme] (src/app/styles/theme.css). */
export function applyTheme(
  theme: Theme,
  root: HTMLElement,
  themeColor: HTMLMetaElement | null,
): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  if (themeColor) themeColor.content = THEME_COLOR[theme];
}
