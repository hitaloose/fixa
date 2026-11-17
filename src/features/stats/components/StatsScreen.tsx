import { type ReactNode, useId, useState } from "react";
import { t } from "../../../i18n/pt-BR";
import { Select } from "../../../ui";
import { useStats } from "../hooks/useStats";
import { ButtonsBars, CardStatesBar, Heatmap, ReviewsChart } from "./charts";

const s = t.stats;
const PERIODS = [7, 30, 90, 365] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-section border border-line bg-surface p-4">
      <h2 id={id} className="mb-3 text-sm font-semibold text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

export function StatsScreen() {
  const [deckId, setDeckId] = useState<string | null>(null);
  const [period, setPeriod] = useState<number>(7);
  const data = useStats(deckId, period);
  const deckSelect = useId();
  const periodName = useId();

  return (
    <div className="flex flex-col gap-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] font-bold">{s.title}</h1>
      <div className="flex flex-col gap-2">
        <label htmlFor={deckSelect} className="sr-only">
          {s.deck}
        </label>
        <Select
          id={deckSelect}
          value={deckId ?? ""}
          onChange={(e) => setDeckId(e.target.value || null)}
        >
          <option value="">{s.allDecks}</option>
          {data?.decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.path}
            </option>
          ))}
        </Select>
        <div role="radiogroup" aria-label={s.period} className="grid grid-cols-4 gap-1">
          {PERIODS.map((p) => (
            <label
              key={p}
              className="flex min-h-11 items-center justify-center rounded-button border border-line text-sm has-checked:border-primary has-checked:bg-new-bg has-checked:text-primary"
            >
              <input
                type="radio"
                name={periodName}
                checked={period === p}
                onChange={() => setPeriod(p)}
                className="sr-only"
              />
              {s.periods[p]}
            </label>
          ))}
        </div>
      </div>

      {data ? (
        <>
          <Section title={s.today}>
            {/* Each tile keeps dt before dd in the DOM; flex-col-reverse shows the number on top. */}
            <dl className="grid grid-cols-4 gap-2">
              <Tile label={s.answers} value={String(data.view.today.reviews)} />
              <Tile label={s.time} value={s.minutes(data.view.today.minutes)} />
              <Tile label={s.correct} value={s.percent(data.view.today.correctRate)} />
              <Tile label={s.again} value={String(data.view.today.again)} />
            </dl>
          </Section>

          <div className="grid grid-cols-2 gap-4">
            <Section title={s.streak}>
              <p className="font-display text-3xl font-bold">{s.streakDays(data.view.streak)}</p>
            </Section>
            <Section title={s.retention}>
              {data.view.retention.rate === null ? (
                <p className="text-sm text-muted">{s.noRetention}</p>
              ) : (
                <>
                  <p className="font-display text-3xl font-bold">
                    {s.percent(data.view.retention.rate)}
                  </p>
                  <p className="text-xs text-muted">
                    {s.retentionDetail(data.view.retention.passed, data.view.retention.total)}
                  </p>
                </>
              )}
            </Section>
          </div>

          <Section title={s.reviews}>
            <p className="mb-2 text-xs text-muted">
              {s.reviewsCaption(data.view.daily.reduce((a, d) => a + d.reviews, 0))}
            </p>
            <ReviewsChart days={data.view.daily} today={data.today} />
          </Section>

          <Section title={s.time}>
            <p className="font-display text-2xl font-bold">
              {s.totalTime(data.view.time.totalMinutes)}
            </p>
            <p className="text-sm text-muted">{s.perDay(data.view.time.minutesPerDay)}</p>
          </Section>

          <Section title={s.heatmap}>
            <Heatmap days={data.view.heatmap} today={data.today} />
          </Section>

          <Section title={s.cardStates}>
            <CardStatesBar states={data.view.cardStates} />
          </Section>

          <Section title={s.buttons}>
            <ButtonsBars buttons={data.view.buttons} />
          </Section>
        </>
      ) : null}
    </div>
  );
}
