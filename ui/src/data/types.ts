/**
 * PROJECT WORLDS — Semantic UI Types
 *
 * These types describe what the UI sees, NOT the raw API shape.
 * The API boundary (api.ts) translates provider types into these.
 */

// ─── Status ─────────────────────────────────────────────

/**
 * Canonical status vocabulary.
 * Source: src/personal_world/status.py (Status enum) — the shared
 * machine vocabulary the server answers with. Rank encoded by
 * luminance only, never hue.
 */
export type CapabilityStatus =
  | "healthy"
  | "warning"
  | "needs_attention"
  | "unavailable"
  | "stale"
  | "disabled"
  | "not_configured"
  | "unknown";

/**
 * Human-readable labels for status levels.
 * The word IS the signal; color is reinforcement only.
 */
export const STATUS_LABELS: Record<CapabilityStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  needs_attention: "Needs attention",
  unavailable: "Unavailable",
  stale: "Stale",
  unknown: "Unknown",
  disabled: "Disabled",
  not_configured: "Not configured",
};

const CAPABILITY_STATUS_VALUES: readonly CapabilityStatus[] = [
  "healthy", "warning", "needs_attention", "unavailable",
  "stale", "disabled", "not_configured", "unknown",
];

/**
 * Narrow a server status string to the UI vocabulary at the boundary.
 * An unrecognized value degrades to "unknown" (Explicit State
 * contract: unknown ≠ healthy) instead of pretending to typecheck
 * through a cast.
 */
export function toCapabilityStatus(raw: string): CapabilityStatus {
  return (CAPABILITY_STATUS_VALUES as readonly string[]).includes(raw)
    ? (raw as CapabilityStatus)
    : "unknown";
}

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
   * Presentational mood. Optional on purpose: the API carries no
   * state field yet, and no consumer renders it. Marking it required
   * was a type-level claim the API does not back up.
   */
  state?: ResidentState;
}

/**
 * The companion preference (`GET /api/prefs → data.companion`,
 * src/personal_world/prefs.py) names the resident shown on Today.
 * Keys are the server preference values; display names follow
 * docs/COMPANION-CANON.md (owner canon 2026-09-17); ids are the
 * ui/public artwork keys. Never invent residents here — this map is
 * the whole of it.
 */
export const COMPANION_RESIDENTS: Record<string, Resident> = {
  "personal-world": { id: "personal-world", name: "Personal World", role: "System companion" },
  mermaid: { id: "renai", name: "Renai", role: "Personal companion" },
  robot: { id: "bolt", name: "Bolt", role: "Lab helper" },
  "world-tree-squirrel": { id: "ratatoskr", name: "Ratatoskr", role: "Lore keeper" },
  "taco-news-truck": { id: "burrito", name: "Burrito Journalism", role: "Stories & city life" },
};

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

// ─── Journal kinds ──────────────────────────────────────

/**
 * Human labels for the server's JournalKind vocabulary
 * (src/personal_world/model.py). A kind the UI has never heard of
 * degrades to a quiet generic label rather than crashing the list.
 */
export const JOURNAL_KIND_LABELS: Record<string, string> = {
  observation: "Observation",
  health: "Health",
  drift: "Drift",
  recommendation: "Recommendation",
  approval: "Approval",
  reconciliation: "Reconciliation",
  provider_action: "Provider action",
  failure: "Failure",
  pack_change: "Pack change",
  settings_change: "Settings change",
  security: "Security",
  discovery: "Discovery",
};

export function journalKindLabel(kind: string): string {
  return JOURNAL_KIND_LABELS[kind] ?? "Journal entry";
}

// ─── Today Screen ───────────────────────────────────────

/**
 * The composed Today view. Single canonical UI shape; `useTodaySummary`
 * (src/data/hooks.ts) is its only producer.
 */
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
