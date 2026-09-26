/**
 * Sorting rooms into the Doorways structure (see RoomsPanel.tsx).
 * Pure functions, shared by the panel and its tests.
 */
import type { RoomNeed, RoomRow } from "../../data/contract";

/** Doorways shown before the rest move to the corridor (desktop spec:
 *  at most three big doors; the grid reflows to one column on phones). */
export const MAX_DOORWAYS = 3;

/** Needs only count for a room that answered — an unreachable room's
 *  needs are unknown, not zero and not current — and only the ones this
 *  person hasn't marked seen (the server's summary counts the same way). */
export function currentNeeds(row: RoomRow): RoomNeed[] {
  if (!row.reachable) return [];
  const seen = new Set(row.needs_seen ?? []);
  return (row.needs_you ?? []).filter((n) => !seen.has(n.id));
}

/** Needs still open in the room that this person has already seen. */
export function seenNeeds(row: RoomRow): RoomNeed[] {
  if (!row.reachable) return [];
  const seen = new Set(row.needs_seen ?? []);
  return (row.needs_you ?? []).filter((n) => seen.has(n.id));
}

function oldestNeedTime(row: RoomRow): number {
  const times = currentNeeds(row)
    .map((n) => new Date(n.created_at).getTime())
    .filter((t) => !Number.isNaN(t));
  return times.length > 0 ? Math.min(...times) : Number.POSITIVE_INFINITY;
}

export function isUncertain(row: RoomRow): boolean {
  // A room we can't read has unknown needs: unreachable, no status, or a
  // contract this front door does not support (never healthy).
  return !row.reachable || row.status === "unknown" || row.status === "incompatible";
}

export interface RoomGroups {
  doorways: RoomRow[];
  alsoNeeds: RoomRow[];
  uncertain: RoomRow[];
  other: RoomRow[];
  quiet: RoomRow[];
}

export function groupRooms(rows: RoomRow[]): RoomGroups {
  const needing = rows
    .filter((r) => currentNeeds(r).length > 0)
    .sort((a, b) => oldestNeedTime(a) - oldestNeedTime(b));
  const rest = rows.filter((r) => currentNeeds(r).length === 0);
  return {
    doorways: needing.slice(0, MAX_DOORWAYS),
    alsoNeeds: needing.slice(MAX_DOORWAYS),
    uncertain: rest.filter(isUncertain),
    other: rest.filter((r) => !isUncertain(r) && r.status !== "healthy"),
    quiet: rest.filter((r) => !isUncertain(r) && r.status === "healthy"),
  };
}
