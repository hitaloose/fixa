/** The device's IANA time zone (e.g. "America/Sao_Paulo"). */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
