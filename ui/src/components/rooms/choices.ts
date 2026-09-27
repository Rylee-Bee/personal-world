/**
 * Plain helpers for a room's decisions and its own actions (ROOM 2.1.0).
 * Kept apart from the components so they stay pure and testable.
 */
import type { OfferField, RoomNeed, RoomOffer, RoomRow } from "../../data/contract";

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
      !a.need_bound &&
      (a.writes === false || canApprove),
  );
}

/** The button words for a room action: its title, else its id in words. */
export function offerLabel(offer: RoomOffer): string {
  return offer.title?.trim() || offer.id.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export type FormValues = Record<string, string | string[]>;

/** The body to send: only filled fields, text trimmed. */
export function formBody(fields: OfferField[], values: FormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (typeof v === "string" && v.trim()) body[f.name] = v.trim();
    if (Array.isArray(v) && v.length) body[f.name] = v;
  }
  return body;
}

export function formReady(fields: OfferField[], values: FormValues): boolean {
  return fields.every((f) => !f.required || (formBody([f], values)[f.name] !== undefined));
}

/** A room picture's name for roomArtUrl: "art/crew/pip.webp" → "pip".
 *  Only a plain file name is accepted (letters, digits, - and _). */
export function artName(file: string | null | undefined): string | null {
  if (!file) return null;
  const m = /(?:^|\/)([A-Za-z0-9_-]+)\.webp$/.exec(file.trim());
  return m ? m[1] : null;
}
