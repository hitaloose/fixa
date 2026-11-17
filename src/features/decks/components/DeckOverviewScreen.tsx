import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { t } from "../../../i18n/pt-BR";
import { Icon } from "../../../ui";
import { useDeckOverview } from "../hooks/useDeckOverview";
import { CountTriplet } from "./CountTriplet";

const COUNT_STYLE = {
  new: "bg-new-bg text-new-ink",
  learning: "bg-learning-bg text-learning-ink",
  review: "bg-review-bg text-review-ink",
} as const;

function BackLink() {
  return (
    <Link
      to="/"
      aria-label={t.overview.back}
      className="inline-flex size-11 items-center justify-center rounded-button text-ink"
    >
      <Icon name="chevronRight" className="size-6 rotate-180" />
    </Link>
  );
}

export function DeckOverviewScreen({ deckId }: { deckId: string }) {
  const overview = useDeckOverview(deckId);
  const todayId = useId();
  const forecastId = useId();
  const subdecksId = useId();

  if (overview === undefined) return null;
  if (overview === null) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        <BackLink />
        <p className="text-muted">{t.overview.notFound}</p>
      </div>
    );
  }

  const { deck, path, counts, minutes, forecast, subdecks } = overview;
  const peak = Math.max(1, ...forecast.map((d) => d.count));
  const dayLabel = (i: number, day: string) =>
    i === 0 ? t.overview.today : i === 1 ? t.overview.tomorrow : t.overview.weekday(day);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <BackLink />
      <header>
        <h1 className="font-display text-[28px] font-bold">{deck.name}</h1>
        {path !== deck.name ? <p className="text-sm text-muted">{path}</p> : null}
      </header>

      <section className="rounded-section border border-line bg-surface p-4">
        <h2 id={todayId} className="sr-only">
          {t.decks.today}
        </h2>
        <ul aria-labelledby={todayId} className="grid grid-cols-3 gap-2">
          {(["new", "learning", "review"] as const).map((key) => (
            <li
              key={key}
              className={`flex flex-col items-center rounded-field py-3 ${COUNT_STYLE[key]}`}
            >
              <span className="font-display text-[28px] font-bold tabular-nums">{counts[key]}</span>
              <span className="text-xs font-medium">{t.overview[key]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-sm text-muted">{t.overview.estimate(minutes)}</p>
      </section>

      <Link
        to="/decks/$deckId/study"
        params={{ deckId: deck.id }}
        className="inline-flex min-h-14 items-center justify-center rounded-list bg-contrast px-4 font-semibold text-on-contrast"
      >
        {t.study.start}
      </Link>

      <section className="rounded-section border border-line bg-surface p-4">
        <h2 id={forecastId} className="text-sm font-semibold">
          {t.overview.forecast}
        </h2>
        <ul aria-labelledby={forecastId} className="mt-3 flex h-28 items-end gap-2">
          {forecast.map(({ day, count }, i) => {
            const label = dayLabel(i, day);
            return (
              <li
                key={day}
                aria-label={t.overview.forecastItem(label, count)}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span aria-hidden="true" className="text-xs tabular-nums text-muted">
                  {count}
                </span>
                <span
                  aria-hidden="true"
                  className="w-full rounded-t-md bg-review"
                  style={{
                    height: `${Math.max(4, (count / peak) * 64)}px`,
                    opacity: count === 0 ? 0.25 : 1,
                  }}
                />
                <span aria-hidden="true" className="text-[11px] text-muted">
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <Link
        to="/add"
        search={{ deckId: deck.id }}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-line bg-surface px-4 font-semibold"
      >
        <Icon name="add" className="size-5" />
        {t.overview.addCard}
      </Link>

      <Link
        to="/decks/$deckId/options"
        params={{ deckId: deck.id }}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-semibold text-primary"
      >
        {t.options.open}
      </Link>

      {subdecks.length > 0 ? (
        <section>
          <h2 id={subdecksId} className="mb-2 text-sm font-semibold">
            {t.overview.subdecks}
          </h2>
          <ul
            aria-labelledby={subdecksId}
            className="divide-y divide-line-soft overflow-hidden rounded-list border border-line bg-surface"
          >
            {subdecks.map((s) => (
              <li key={s.deck.id}>
                <Link
                  to="/decks/$deckId"
                  params={{ deckId: s.deck.id }}
                  className="flex min-h-11 items-center gap-2 px-4 py-3"
                >
                  <span className="flex-1 font-medium">{s.deck.name}</span>
                  <CountTriplet counts={s.counts} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
