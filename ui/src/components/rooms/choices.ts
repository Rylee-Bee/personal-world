/**
 * Plain helpers for a room's decisions and its own actions (ROOM 2.1.0).
 * Kept apart from the components so they stay pure and testable.
 */
import type { RoomNeed, RoomOffer, RoomRow } from "../../data/contract";

/** The action that answers a need with one of its `choices`. */
export const ANSWER_ACTION = "answer-decision";
const MAX_CHOICES = 6;
/** Actions tied to one need: offered on that need, never as room actions. */
const NEED_ACTIONS = new Set(["approve", "decline", ANSWER_ACTION]);

/** The need's choices, cleaned: strings only, trimmed, no blanks or
 *  repeats, at most six. An empty list means "not a choice need". */
export function needChoices(need: RoomNeed): string[] {
  if (!Array.isArray(need.choices)) return [];
  const out: string[] = [];
  for (const c of need.choices) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (t && !out.includes(t)) out.push(t);
    if (out.length === MAX_CHOICES) break;
  }
  return out;
}

/** The room marks its recommendation by starting `why` with
 *  "Recommended:"; then the first choice is the recommended one. */
export function hasRecommendation(need: RoomNeed): boolean {
  return /^\s*recommended\s*:/i.test(need.why ?? "");
}

/** The room's own actions this person can be offered from the drawer.
 *  A write (`writes` true or missing: fail closed) needs `approve`. */
export function roomOffers(row: RoomRow, canApprove: boolean): RoomOffer[] {
  if (!Array.isArray(row.actions)) return [];
  return row.actions.filter(
    (a) =>
      a &&
      typeof a.id === "string" &&
      a.id.trim() !== "" &&
      !NEED_ACTIONS.has(a.id) &&
      (a.writes === false || canApprove),
  );
}

/** The button words for a room action: its title, else its id in words. */
export function offerLabel(offer: RoomOffer): string {
  return offer.title?.trim() || offer.id.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
}
