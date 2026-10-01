import type { Board, BoardItem, CardEnvelope, NeedsYouEntry } from "./types";

export type SectionKey = "needs_you" | "needs_look" | "pick_up" | "your_life" | "quietly_working";
export interface Row { item: BoardItem; card: CardEnvelope }
export interface Sections {
  needs_you: NeedsYouEntry[];
  needs_look: Row[];
  your_life: Row[];
  quietly_working: Row[];
  /** not_configured sources: strip only, never a row. */
  not_configured: Row[];
}

const WORST: Record<string, number> = { unavailable: 0, degraded: 1, stale: 2, needs_attention: 3, unknown: 4 };
export const SECTION_TITLE: Record<SectionKey, string> = {
  needs_you: "Needs you",
  needs_look: "Needs a look",
  pick_up: "Pick up",
  your_life: "Your life",
  quietly_working: "Quietly working",
};

const rank = (c: CardEnvelope) => (c.source_state in WORST ? WORST[c.source_state] : WORST.stale);

/**
 * Place each visible item in exactly one section (C6). Needs a look: state in
 * {unavailable, degraded, stale, needs_attention, unknown} or freshness stale, worst first, stable for ties.
 * Your life: healthy + life. Quietly working: healthy + machine. not_configured: strip only.
 * Pure: callers must not re-run this while the user is focused in the list.
 */
export function buildSections(board: Board, cards: Record<string, CardEnvelope>, needsYou: NeedsYouEntry[] = []): Sections {
  const out: Sections = { needs_you: needsYou, needs_look: [], your_life: [], quietly_working: [], not_configured: [] };
  for (const item of board.items) {
    if (item.hidden) continue;
    const card = cards[item.card];
    if (!card) continue;
    const row = { item, card };
    if (card.source_state === "not_configured") out.not_configured.push(row);
    else if (card.source_state !== "healthy" || card.freshness === "stale") out.needs_look.push(row);
    else if (item.group === "life") out.your_life.push(row);
    else out.quietly_working.push(row);
  }
  out.needs_look = out.needs_look
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r.card) - rank(b.r.card) || a.i - b.i)
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
    const s = r.card.source_state;
    const w = s === "unavailable" ? "down" : s === "degraded" ? "slow" : s === "needs_attention" ? "needs a look" : s === "unknown" ? "unclear" : "stale";
    parts.push(`${r.item.title} ${w}`);
  }
  if (look.length > 2) parts.push(`${look.length - 2} more to look at`);
  parts.push(parts.length === 0 ? "all quiet" : "rest quiet");
  return parts.join(" · ");
}
