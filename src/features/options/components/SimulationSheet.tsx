import { useEffect, useState } from "react";
import { runtime } from "../../../data/runtime";
import { subtreeIds } from "../../../domain/decks";
import type { Preset } from "../../../domain/model";
import { type SimulatedDay, simulateWorkload } from "../../../domain/stats";
import { t } from "../../../i18n";
import { Sheet } from "../../../ui";

const o = t.options;
const DAYS = 30;

/** "Simular carga": the next 30 days of reviews with the draft preset values. */
export function SimulationSheet({
  deckId,
  preset,
  onClose,
}: {
  deckId: string;
  preset: Preset;
  onClose: () => void;
}) {
  const [days, setDays] = useState<SimulatedDay[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { repos, clock } = runtime();
      const decks = await repos.decks.listActive();
      const cards = await repos.cards.inDecks(subtreeIds(deckId, decks));
      const result = simulateWorkload({
        cards,
        preset,
        days: DAYS,
        now: clock.now(),
        seed: `${deckId}:${clock.now()}`,
      });
      if (!cancelled) setDays(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [deckId, preset]);

  const total = days?.reduce((sum, d) => sum + d.reviews, 0) ?? 0;
  const peak = Math.max(1, ...(days?.map((d) => d.reviews) ?? [0]));
  const minutes = days ? Math.round(days.reduce((s, d) => s + d.minutes, 0) / DAYS) : 0;

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={o.simulate}
      description={o.simulateIntro}
      closeLabel={t.common.close}
    >
      {days ? (
        <div className="flex flex-col gap-3">
          <p className="font-medium">
            {o.simulateAverage(Math.round((total / DAYS) * 10) / 10, minutes)}
          </p>
          <p className="text-sm text-muted">
            {o.simulatePeak(Math.max(0, ...days.map((d) => d.reviews)))}
          </p>
          <div className="flex h-24 items-end gap-0.5" aria-hidden="true">
            {days.map((d) => (
              <div
                key={d.day}
                title={`${o.simulateDayLabel(d.day)}: ${d.reviews}`}
                className="flex-1 rounded-t bg-primary"
                style={{
                  height: `${Math.max(2, (d.reviews / peak) * 96)}px`,
                  opacity: d.reviews === 0 ? 0.25 : 1,
                }}
              />
            ))}
          </div>
          <table aria-label={o.simulateTable} className="sr-only">
            <thead>
              <tr>
                <th scope="col">{o.simulateDay}</th>
                <th scope="col">{o.simulateReviews}</th>
                <th scope="col">{o.simulateNew}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day}>
                  <td>{o.simulateDayLabel(d.day)}</td>
                  <td>{d.reviews}</td>
                  <td>{d.newCards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Sheet>
  );
}
