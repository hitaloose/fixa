import type { QueueCounts } from "../../../domain/queue";
import { t } from "../../../i18n";

const TONES = {
  new: "text-new-ink",
  learning: "text-learning-ink",
  review: "text-review-ink",
} as const;

/** New / learning / review counts; zeros are faint. Screen readers get one sentence. */
export function CountTriplet({ counts }: { counts: QueueCounts }) {
  return (
    <span className="flex gap-3 text-sm font-semibold tabular-nums">
      <span className="sr-only">{t.decks.counts(counts)}</span>
      {(["new", "learning", "review"] as const).map((key) => (
        <span
          key={key}
          aria-hidden="true"
          className={`min-w-6 text-right ${counts[key] === 0 ? "text-faint" : TONES[key]}`}
        >
          {counts[key]}
        </span>
      ))}
    </span>
  );
}
