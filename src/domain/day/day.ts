/**
 * Study day: the "day" starts at the cutoff hour in the device's time zone, like Anki
 * (docs/05-agendamento.md › Dia de estudo). This is the only place that turns an instant into a day.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function wallTime(instant: number, timeZone: string): WallTime {
  const parts: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(instant)) parts[p.type] = Number(p.value);
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
  };
}

/** Offset of the zone from UTC at `instant` (a whole minute), in ms, positive east of UTC. */
function offsetAt(instant: number, timeZone: string): number {
  const w = wallTime(instant, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) - instant;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

function formatDay(utcMidnight: number): string {
  const d = new Date(utcMidnight);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function parseDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

function assertCutoff(cutoffHour: number): void {
  if (!Number.isInteger(cutoffHour) || cutoffHour < 0 || cutoffHour > 23) {
    throw new RangeError(`cutoffHour must be an integer 0–23, got ${cutoffHour}`);
  }
}

export function addDays(day: string, n: number): string {
  return formatDay(parseDay(day) + n * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to) - parseDay(from)) / DAY_MS);
}

/** "YYYY-MM-DD" of the study day containing `now`. */
export function studyDay(now: number, cutoffHour: number, timeZone: string): string {
  assertCutoff(cutoffHour);
  const w = wallTime(now, timeZone);
  const calendarDay = formatDay(Date.UTC(w.year, w.month - 1, w.day));
  return w.hour < cutoffHour ? addDays(calendarDay, -1) : calendarDay;
}

/**
 * First instant of the next study day (exclusive end of today). Handles DST: when the cutoff
 * wall time is skipped it is the moment clocks jump past it; when repeated, its first occurrence.
 */
export function endOfStudyDay(now: number, cutoffHour: number, timeZone: string): number {
  const tomorrow = addDays(studyDay(now, cutoffHour, timeZone), 1);
  const wallAsUtc = parseDay(tomorrow) + cutoffHour * HOUR_MS;
  const candidates = [
    wallAsUtc - offsetAt(wallAsUtc - DAY_MS, timeZone),
    wallAsUtc - offsetAt(wallAsUtc + DAY_MS, timeZone),
  ].filter((c) => studyDay(c, cutoffHour, timeZone) === tomorrow);
  return Math.min(...candidates);
}
