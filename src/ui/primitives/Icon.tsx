const PATHS = {
  decks: "M4 7h13v13H4zM7 4h13v13",
  browse: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16.5 16.5 21 21",
  add: "M12 5v14M5 12h14",
  stats: "M5 20V11M12 20V4M19 20v-6",
  chevronRight: "M9 6l6 6-6 6",
  close: "M6 6l12 12M18 6 6 18",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z",
  italic: "M10 5h8M6 19h8M14 5l-4 14",
  underline: "M7 4v7a5 5 0 0 0 10 0V4M5 20h14",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 8.5h.01",
  audio: "M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  cloze: "M8 5H4v14h4M16 5h4v14h-4M9 12h6",
  pin: "M9 4h6l-1 6 4 4H6l4-4zM12 14v6",
  sigma: "M18 5H6l6 7-6 7h12",
  undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  history: "M4 12a8 8 0 1 0 2.3-5.6L4 8.7M4 4v4.7h4.7M12 8v4l3 2",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
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
