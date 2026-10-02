/** Types for the front-door UI. Shapes follow docs/rebuild/CONTRACTS.md (C1 board, C2 envelope, C5 props). */

export type SourceState =
  | "healthy" | "needs_attention" | "degraded" | "unavailable" | "stale" | "unknown" | "not_configured";
export type Freshness = "current" | "stale";
export type ErrorClass =
  | "timeout" | "connection" | "http_4xx" | "http_5xx" | "malformed"
  | "redirect_refused" | "too_large" | "confinement_denied" | "auth_failed";
export type CardGroup = "life" | "machine";
export type Size = "S" | "M" | "L";

/** C2 meter. A key is absent when its number is missing (draw nothing); an explicit 0 is real; items [] is an existing empty list. */
export type Meter =
  | { type: "progress"; text_equivalent: string; value?: number; max?: number }
  | { type: "segments"; text_equivalent: string; count?: number; filled?: number }
  | { type: "bars" | "dots" | "marks" | "day" | "shelf"; text_equivalent: string; items?: (number | string | boolean)[] };

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
  action: { kind: "open"; href: string } | { kind: "approve"; authorization_id: string; href?: string };
}

export type Words = "minimal" | "short" | "full";
export type Density = "calm" | "standard" | "detailed";
export type TextSize = "standard" | "large" | "larger";
export type Pack = "none" | "station";
export type Theme = "starfield" | "daylight";

export const STATE_SHAPE: Record<SourceState, { shape: string; word: string }> = {
  healthy: { shape: "●", word: "Healthy" },
  needs_attention: { shape: "▲", word: "Needs attention" },
  degraded: { shape: "◆", word: "Degraded" },
  unavailable: { shape: "■", word: "Unavailable" },
  stale: { shape: "◌", word: "Stale" },
  unknown: { shape: "○", word: "Unknown" },
  not_configured: { shape: "◇", word: "Not configured" },
};

/** C1 Connect: config object kinds. Every object is wrapped in an etag-bearing envelope. */
export type ConfigKind = "provider" | "request" | "card" | "action";

export interface Auth {
  type: "none" | "bearer" | "header" | "basic";
  header_name?: string;
  /** `env:NAME` or `vault:NAME`. Only the reference NAME is ever stored or shown. */
  secret_ref?: string;
}

export interface Provider {
  id: string;
  name: string;
  kind: "http" | "room0" | "reference";
  base_url: string;
  path_prefix?: string;
  auth: Auth;
  network?: { lan?: boolean };
  tls_verify?: boolean;
  timeout_s?: number;
}

export type RequestEffect = "auto" | "read" | "write";
export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Request {
  id: string;
  provider: string;
  method: HttpMethod;
  path: string;
  effect: RequestEffect;
  known_safe?: boolean;
  ttl_s?: number;
  timeout_s?: number;
}

export interface CardMeaning {
  concept?: string;
  short: string;
  full: string;
}

export interface CardConfig {
  id: string;
  title: string;
  icon: string;
  group: CardGroup;
  request?: string;
  requests?: string[];
  view: "stat" | "list" | "table" | "status" | "meter" | "link" | "markdown";
  meaning: CardMeaning;
  fields?: { key: string; label: string; path: string; format?: Format; unit?: string }[];
}

export interface ConfigItem<T> {
  id: string;
  etag: string;
  object: T;
}

export interface ConfigList<T> {
  items: ConfigItem<T>[];
  errors: { file: string; reason: string }[];
}

/** POST /api/connect/try response. */
export interface TryResult {
  ok: boolean;
  status_code?: number;
  duration_ms?: number;
  error_class?: ErrorClass;
  note?: string;
  content_type?: string;
  sample?: string;
  truncated?: boolean;
  suggested_fields?: { label: string; path: string; format?: string; sample?: unknown }[];
}

/** POST /api/connect/preview response (a C2 envelope). */
export interface PreviewResult {
  card_id: string;
  source_state: SourceState;
  freshness: Freshness;
  observed_at: string | null;
  fetched_at: string;
  last_good_at: string | null;
  values: Record<string, { text: string; raw?: unknown }>;
  meter: Meter | null;
  meaning: { short: string; full: string };
  evidence: CardEnvelope["evidence"];
}

/** GET /api/actions response. */
export interface ActionSummary {
  id: string;
  name: string;
  access: "read" | "write";
  approval?: string;
  scope?: string;
  exposed?: boolean;
}

/** GET /api/receipts response. */
export interface Receipt {
  id: string;
  action: string;
  dispatch_state: string;
  outcome: string;
  started_at?: string;
  finished_at?: string;
  redacted?: boolean;
}
