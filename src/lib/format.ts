/** Labels come from src/i18n (lib imports nothing from the project). */
export interface IntervalLabels {
  lessThanMinute: string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  days: (n: number) => string;
  months: (n: number) => string;
  years: (n: number) => string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const oneDecimal = (n: number) => Math.round(n * 10) / 10;

/**
 * Human interval for the answer buttons ("< 1 min", "6 min", "1 dia", "1,5 mês").
 * Each unit is used only while its rounded value stays below the next unit.
 */
export function formatInterval(ms: number, labels: IntervalLabels): string {
  if (ms < MIN) return labels.lessThanMinute;
  const minutes = Math.round(ms / MIN);
  if (minutes < 60) return labels.minutes(minutes);
  const hours = Math.round(ms / HOUR);
  if (hours < 24) return labels.hours(hours);
  const days = Math.round(ms / DAY);
  if (days < 30) return labels.days(days);
  const months = oneDecimal(ms / DAY / 30);
  if (months < 12) return labels.months(months);
  return labels.years(oneDecimal(ms / DAY / 365));
}
