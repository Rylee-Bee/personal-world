/** Plain dates for visits and helpers ("Friday, Oct 3"). */
export function dayWords(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "";
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

/** An end-of-day ISO time for a yyyy-mm-dd date field. */
export function endOfDayIso(date: string): string {
  const d = new Date(`${date}T21:00:00`);
  return d.toISOString();
}

/** yyyy-mm-dd for a date input, n days from now. */
export function dateInDays(n: number): string {
  const d = new Date(Date.now() + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** The link a person opens to accept an invite; the code stays after
 *  "#", so it never reaches a server log. */
export function inviteLink(token: string): string {
  return `${window.location.origin}/invite#${token}`;
}

/** Limits, said plainly ("Chat rests 21:00–07:00"). */
export function limitLines(limits: {
  chat_quiet_hours?: string;
  no_outside_sharing?: boolean;
  content_boundary?: string;
}): string[] {
  const out: string[] = [];
  if (limits.chat_quiet_hours) out.push(`Chat rests from ${limits.chat_quiet_hours.replace("-", " to ")}`);
  if (limits.no_outside_sharing) out.push("Nothing is shared outside this World");
  if (limits.content_boundary === "gentle") out.push("Finds and chat stay gentle");
  return out;
}
