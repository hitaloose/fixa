/**
 * Small SVG charts for the stats screen (no chart library). Marks follow the dataviz rules:
 * thin bars with rounded data ends, recessive axis, single hue for one series, a per-mark
 * tooltip (<title>) and the numbers always available as text or a table.
 */
import { useEffect, useRef } from "react";
import type { DayActivity } from "../../../domain/stats";
import { t } from "../../../i18n";

const s = t.stats;

/** A bar rising from the baseline with a rounded top (square at the baseline). */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function ReviewsChart({ days, today }: { days: DayActivity[]; today: string }) {
  const width = 358;
  const height = 120;
  const max = Math.max(1, ...days.map((d) => d.reviews));
  const slot = width / days.length;
  const barWidth = Math.max(1, Math.min(24, slot - 2));
  const label = (d: DayActivity) => s.dayLabel(d.day, d.day === today);
  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height + 1}`}
        className="h-32 w-full"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <line x1={0} x2={width} y1={height} y2={height} className="stroke-line" strokeWidth={1} />
        {days.map((d, i) => {
          const h = (d.reviews / max) * (height - 4);
          return d.reviews === 0 ? null : (
            <path
              key={d.day}
              d={barPath(i * slot + (slot - barWidth) / 2, height - h, barWidth, h)}
              className="fill-primary"
            >
              <title>{s.reviewsOn(label(d), d.reviews)}</title>
            </path>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted" aria-hidden="true">
        <span>{label(days[0] as DayActivity)}</span>
        <span>max {max}</span>
        <span>{s.dayLabel(today, true)}</span>
      </div>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">{s.day}</th>
            <th scope="col">{s.count}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{label(d)}</td>
              <td>{d.reviews}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function Heatmap({ days, today }: { days: DayActivity[]; today: string }) {
  const cell = 10;
  const gap = 2;
  // Columns are weeks; the first column starts on the weekday of the first day.
  const firstWeekday = new Date(`${days[0]?.day ?? today}T12:00:00Z`).getUTCDay();
  const columns = Math.ceil((days.length + firstWeekday) / 7);
  const max = Math.max(1, ...days.map((d) => d.reviews));
  const active = days.filter((d) => d.reviews > 0).length;
  const level = (n: number) => (n === 0 ? 0 : Math.ceil((n / max) * 4));
  const scroller = useRef<HTMLDivElement>(null);
  // Open on the most recent weeks (today is at the right end).
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);
  return (
    <div ref={scroller} className="overflow-x-auto">
      <svg
        role="img"
        aria-label={s.heatmapLabel(days.length, active)}
        width={columns * (cell + gap)}
        height={7 * (cell + gap)}
      >
        {days.map((d, i) => {
          const index = i + firstWeekday;
          const l = level(d.reviews);
          return (
            <rect
              key={d.day}
              x={Math.floor(index / 7) * (cell + gap)}
              y={(index % 7) * (cell + gap)}
              width={cell}
              height={cell}
              rx={2}
              className={l === 0 ? "fill-line-soft" : "fill-review"}
              fillOpacity={l === 0 ? 1 : l / 4}
            >
              <title>{s.reviewsOn(s.dayLabel(d.day, d.day === today), d.reviews)}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

const STATE_COLORS = {
  new: "bg-new",
  learning: "bg-learning",
  review: "bg-review",
  suspended: "bg-faint",
  buried: "bg-line",
} as const;

export function CardStatesBar({ states }: { states: Record<keyof typeof STATE_COLORS, number> }) {
  const total = Object.values(states).reduce((a, b) => a + b, 0);
  const keys = Object.keys(STATE_COLORS) as Array<keyof typeof STATE_COLORS>;
  if (total === 0) return <p className="text-sm text-muted">{s.noCards}</p>;
  return (
    <>
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-chip" aria-hidden="true">
        {keys
          .filter((k) => states[k] > 0)
          .map((k) => (
            <div
              key={k}
              className={STATE_COLORS[k]}
              style={{ flexGrow: states[k] }}
              title={s.stateCount(s.states[k], states[k])}
            />
          ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-1 text-sm">
        {keys.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden="true" className={`size-3 rounded-sm ${STATE_COLORS[k]}`} />
            <span>{s.stateCount(s.states[k], states[k])}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ButtonsBars({ buttons }: { buttons: Record<1 | 2 | 3 | 4, number> }) {
  const max = Math.max(1, ...Object.values(buttons));
  return (
    <ul className="flex flex-col gap-2">
      {([1, 2, 3, 4] as const).map((r) => (
        <li key={r} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-2 text-sm">
          <span>{t.study.ratings[r]}</span>
          <span aria-hidden="true" className="h-3 rounded-r bg-line-soft">
            <span
              className="block h-3 rounded-r bg-primary"
              style={{ width: `${(buttons[r] / max) * 100}%` }}
            />
          </span>
          <span className="text-right tabular-nums">{buttons[r]}</span>
        </li>
      ))}
    </ul>
  );
}
