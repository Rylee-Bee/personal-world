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
  values: Record<string, { text: string; raw?: number | string | null | unknown[] }>;
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

export type Format = "number" | "percent" | "bytes" | "duration" | "relative_time" | "text";
export type MeterType = Meter["type"];

/** C6: display definition derived from the C1 card. No request ids, paths, URLs or JSONPaths. Primary value is fields[0]. */
export interface BoardItem {
  card: string;
  size: Size;
  hidden: boolean;
  title: string;
  icon: string;
  group: CardGroup;
  view: "stat" | "list" | "table" | "status" | "meter" | "link" | "markdown";
  fields: { key: string; label: string; format: Format; unit?: string }[];
  meter_type: MeterType | null;
}

export interface Board {
  id: string;
  title: string;
  items: BoardItem[];
}

/** C6: GET /api/needs-you */
export interface NeedsYouEntry {
  id: string;
  text: string;
  source: string;
  created_at: string;
  action: { kind: "open"; href: string } | { kind: "approve"; authorization_id: string };
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
