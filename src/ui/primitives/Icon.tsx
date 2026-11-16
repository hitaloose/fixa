const PATHS = {
  decks: "M4 7h13v13H4zM7 4h13v13",
  browse: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16.5 16.5 21 21",
  add: "M12 5v14M5 12h14",
  stats: "M5 20V11M12 20V4M19 20v-6",
  chevronRight: "M9 6l6 6-6 6",
  close: "M6 6l12 12M18 6 6 18",
  more: "M5 12h.01M12 12h.01M19 12h.01",
} as const;

export type IconName = keyof typeof PATHS;

/** Decorative icon. Meaning must come from visible text or the parent's aria-label. */
export function Icon({ name, className = "size-6" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
