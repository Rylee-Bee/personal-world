/** Newest first, by timestamp (stable for equal times). The journal API
 *  answers oldest first (the last n entries). */
export function newestFirst<T extends { ts: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
}

/** Journal kinds written by the system, not the person, hidden by default. */
export const AUTOMATIC_KINDS = "settings_change";
