import type { Board, BoardItem, CardEnvelope } from "./types";

export type SectionKey = "needs_you" | "needs_look" | "pick_up" | "your_life" | "quietly_working";
export interface Row { item: BoardItem; card: CardEnvelope }
export type Sections = Record<Exclude<SectionKey, "pick_up">, Row[]>;

const WORST: Record<string, number> = {
  unavailable: 0, degraded: 1, stale: 2, needs_attention: 3, unknown: 4, not_configured: 5, healthy: 6,
};
export const SECTION_TITLE: Record<SectionKey, string> = {
  needs_you: "Needs you",
  needs_look: "Needs a look",
  pick_up: "Pick up",
  your_life: "Your life",
  quietly_working: "Quietly working",
};

/**
 * Place each visible item in exactly one section. Order within a section follows the board, except
 * "Needs a look", which is worst first (stable for ties). Pure: callers must not re-run this while the
 * user is focused in the list.
 */
export function buildSections(board: Board, cards: Record<string, CardEnvelope>): Sections {
  const out: Sections = { needs_you: [], needs_look: [], your_life: [], quietly_working: [] };
  for (const item of board.items) {
    if (item.hidden) continue;
    const card = cards[item.card];
    if (!card) continue;
    const row = { item, card };
    const s = card.source_state;
    if (item.needs_you) out.needs_you.push(row);
    else if (s === "unavailable" || s === "degraded" || s === "stale" || s === "needs_attention") out.needs_look.push(row);
    else if (item.group === "life") out.your_life.push(row);
    else out.quietly_working.push(row);
  }
  out.needs_look = out.needs_look
    .map((r, i) => ({ r, i }))
    .sort((a, b) => WORST[a.r.card.source_state] - WORST[b.r.card.source_state] || a.i - b.i)
    .map((x) => x.r);
  return out;
}

/** Terse briefing, e.g. "2 for you · Downloads down · rest quiet". */
export function briefing(sections: Sections): string {
  const parts: string[] = [];
  const n = sections.needs_you.length;
  if (n > 0) parts.push(`${n} for you`);
  const look = sections.needs_look;
  for (const r of look.slice(0, 2)) {
    const w = r.card.source_state === "stale" ? "stale" : r.card.source_state === "needs_attention" ? "needs a look" : "down";
    parts.push(`${r.item.title} ${w}`);
  }
  if (look.length > 2) parts.push(`${look.length - 2} more to look at`);
  parts.push(parts.length === 0 ? "all quiet" : "rest quiet");
  return parts.join(" · ");
}
