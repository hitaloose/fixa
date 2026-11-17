import { useId } from "react";
import { t } from "../../../i18n/pt-BR";
import type { DaySummary } from "../model/deckList";

export function TodaySummary({ summary }: { summary: DaySummary }) {
  const id = useId();
  const total = summary.counts.new + summary.counts.learning + summary.counts.review;
  return (
    <section aria-labelledby={id} className="rounded-section bg-contrast p-4 text-on-contrast">
      <h2 id={id} className="text-xs font-semibold tracking-wide uppercase opacity-70">
        {t.decks.today}
      </h2>
      {total === 0 ? (
        <p className="mt-1 text-[15px]">{t.decks.nothingToday}</p>
      ) : (
        <p className="mt-1 flex items-baseline gap-3">
          <span className="font-display text-[28px] font-bold">{t.decks.todayCards(total)}</span>
          <span className="text-sm opacity-80">{t.decks.todayMinutes(summary.minutes)}</span>
        </p>
      )}
    </section>
  );
}
