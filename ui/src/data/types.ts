/**
 * PROJECT WORLDS — Semantic UI Types
 *
 * These types describe what the UI sees, NOT the raw API shape.
 * The API boundary (api.ts) translates provider types into these.
 */

// ─── Status ─────────────────────────────────────────────

/**
 * Canonical status vocabulary.
 * Source: design/tokens.json → status_vocabulary
 * Rank encoded by luminance only, never hue.
 */
export type CapabilityStatus =
  | "healthy"
  | "needs_attention"
  | "unavailable"
  | "stale"
  | "unknown"
  | "disabled"
  | "not_configured";

/**
 * Human-readable labels for status levels.
 * The word IS the signal; color is reinforcement only.
 */
export const STATUS_LABELS: Record<CapabilityStatus, string> = {
  healthy: "Healthy",
  needs_attention: "Needs attention",
  unavailable: "Unavailable",
  stale: "Stale",
  unknown: "Unknown",
  disabled: "Disabled",
  not_configured: "Not configured",
};

// ─── World Signal ───────────────────────────────────────

/**
 * Signal levels for WorldSignal component.
 * Separate from capability status — this is UI-level urgency.
 */
export type WorldSignalLevel = "good" | "update" | "waiting" | "critical";

export const SIGNAL_LABELS: Record<WorldSignalLevel, string> = {
  good: "Good news",
  update: "A small update",
  waiting: "When you're ready",
  critical: "Needs your attention",
};

// ─── Resident ───────────────────────────────────────────

export type ResidentState =
  | "rest"
  | "curious"
  | "attentive"
  | "engaged"
  | "protective"
  | "giving-space";

export interface Resident {
  id: string;
  name: string;
  role?: string;
  artwork?: string;
  /**
   * Presentational mood. Optional on purpose: /api/actors carries no
   * state field yet, and no consumer renders it. Marking it required
   * was a type-level claim the API does not back up.
   */
  state?: ResidentState;
}

// ─── World Area ─────────────────────────────────────────

export type WorldAreaId =
  | "today"
  | "systems"
  | "projects"
  | "journal"
  | "news"
  | "interests"
  | "records"
  | "settings";

export interface WorldArea {
  id: WorldAreaId;
  label: string;
  href: string;
  icon?: string;
}

export const WORLD_AREAS: WorldArea[] = [
  { id: "today", label: "Today", href: "/today" },
  { id: "systems", label: "Systems", href: "/systems" },
  { id: "projects", label: "Projects", href: "/projects" },
  { id: "journal", label: "Journal", href: "/journal" },
  { id: "news", label: "News", href: "/news" },
  { id: "interests", label: "Interests", href: "/interests" },
  { id: "records", label: "Records", href: "/records" },
  { id: "settings", label: "Settings", href: "/settings" },
];

// ─── Today Screen ───────────────────────────────────────

export interface TodaySummary {
  greeting: string;
  resident?: Resident;
  signals: WorldSignal[];
  capabilities: CapabilitySummary[];
}

export interface WorldSignal {
  id: string;
  level: WorldSignalLevel;
  title: string;
  description?: string;
}

export interface CapabilitySummary {
  id: string;
  name: string;
  status: CapabilityStatus;
  summary?: string;
}
