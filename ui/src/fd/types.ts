/** Types for the front-door UI. Shapes follow docs/rebuild/CONTRACTS.md (C1 board, C2 envelope, C5 props). */

export type SourceState =
  | "healthy" | "needs_attention" | "degraded" | "unavailable" | "stale" | "unknown" | "not_configured";
export type Freshness = "current" | "stale";
export type ErrorClass =
  | "timeout" | "connection" | "http_4xx" | "http_5xx" | "malformed"
  | "redirect_refused" | "too_large" | "confinement_denied" | "auth_failed";
export type CardGroup = "life" | "machine";
export type Size = "S" | "M" | "L";

export type Meter =
  | { type: "segments"; filled: number; total: number; text_equivalent: string }
  | { type: "bars"; values: number[]; max?: number; text_equivalent: string }
  | { type: "progress"; value: number; max: number; text_equivalent: string }
  | { type: "marks"; shown: number; more: number; text_equivalent: string }
  | { type: "dots"; on: number; total: number; text_equivalent: string }
  | { type: "day"; events: { at: string; label: string }[]; text_equivalent: string }
  | { type: "shelf"; items: string[]; text_equivalent: string };

export interface CardEnvelope {
  card_id: string;
  source_state: SourceState;
  freshness: Freshness;
  observed_at: string | null;
  fetched_at: string;
  last_good_at: string | null;
  values: Record<string, { text: string; raw?: number | string | null }>;
  meter: Meter | null;
  meaning: { short: string; full: string };
  evidence: {
    request_id: string;
    method: string;
    path: string;
    status_code?: number;
    duration_ms?: number;
    error_class?: ErrorClass;
    note?: string;
  };
}

/** Card definition fields the UI needs to lay a row out (C1 card, as the board response carries it). */
export interface BoardItem {
  card: string;
  size: Size;
  hidden: boolean;
  title: string;
  icon: string;
  group: CardGroup;
  /** Name of the primary entry in `values`, and its unit label. */
  primary: { field: string; unit?: string };
  /** True only when the item needs the owner to act (a room/0 needs-you entry). Never inferred from state. */
  needs_you?: boolean;
}

export interface Board {
  id: string;
  title: string;
  home: boolean;
  items: BoardItem[];
}

export type Words = "minimal" | "short" | "full";
export type Density = "calm" | "standard" | "detailed";
export type Pack = "none" | "station";
export type Theme = "starfield" | "daylight" | "plain";

export const STATE_SHAPE: Record<SourceState, { shape: string; word: string }> = {
  healthy: { shape: "●", word: "Healthy" },
  needs_attention: { shape: "▲", word: "Needs attention" },
  degraded: { shape: "◆", word: "Degraded" },
  unavailable: { shape: "■", word: "Unavailable" },
  stale: { shape: "◌", word: "Stale" },
  unknown: { shape: "○", word: "Unknown" },
  not_configured: { shape: "◇", word: "Not configured" },
};
