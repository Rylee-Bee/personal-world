/** "HH:MM" (24h) for an ISO time in the given zone (default: the host's), or null when it can't be read. */
export function formatClock(iso: string, timeZone?: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(date);
}
