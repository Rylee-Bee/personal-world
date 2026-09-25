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
 * src/personal_world/prefs.py) names the resident shown on Overview.
 * Keys are the server preference values; display names follow
 * docs/COMPANION-CANON.md (owner canon 2026-09-17); ids are the
 * ui/public artwork keys. Never invent residents here — this map is
 * the whole of it.
 *
 * `assistant` is the plain default helper with a screen for a face
 * (owner, 2026-09-25). `personal-world` is deliberately ABSENT: that key
 * is Sol, the Worlds mark, and she has no voice — choosing her means no
 * companion resident at all (the one plain voice).
 */
export const COMPANION_RESIDENTS: Record<string, Resident> = {
  assistant: { id: "assistant", name: "Assistant", role: "Default helper" },
  mermaid: { id: "renai", name: "Renai", role: "Personal companion" },
  robot: { id: "bolt", name: "Bolt", role: "Lab helper" },
  "world-tree-squirrel": { id: "ratatoskr", name: "Ratatoskr", role: "Lore keeper" },
  "taco-news-truck": { id: "burrito", name: "Scoop", role: "Burrito Journalism's truck" },
};

// ─── Attention language (Overview cards) ─────────────────
//
// The daily digest's attention list carries server strings shaped like
// "source_control: needs_attention" — src/personal_world/loop.py builds
// them as `${capability}: ${status}`, sometimes with an em-dash note
// after the status, and mixes in already-prose action lines. The UI
// must never hand a person a bare snake_case token (PRODUCT-LANGUAGE.md
// — "warm in tone, exact in facts"; technical depth on demand, not
// forced). plainAttention translates what it can and degrades honestly
// what it can't; the raw string always stays reachable behind the
// card's detail disclosure.

/**
 * Human display names for the station's capability ids — mirrors
 * STANDARD_CAPABILITIES in src/personal_world/app.py. An id the UI has
 * never heard of degrades to its words, humanized (never the raw
 * token), the way journalKindLabel degrades an unknown kind.
 */
export const CAPABILITY_NAMES: Record<string, string> = {
  source_control: "Source control",
  deployment: "Deployments",
  secrets: "Secrets",
  calendar: "Calendar",
  discovery: "Discovery",
  settings_validation: "Settings validation",
  service_validation: "Service checks",
  update_discovery: "Update checks",
  memory: "Memory search",
  journal: "Journal",
  reasoning: "The assistant",
  notifications: "Notifications",
  scheduler: "Scheduled tasks",
  homelab_settings: "Homelab settings",
  homelab_health: "Homelab health",
  homelab_deploy: "Homelab deployments",
  homelab_secrets: "Homelab secrets",
  homelab_resources: "Homelab resources",
};

/** The human name for any capability id — the curated one when the
 *  station advertises a capability the UI knows, a readable humanized
 *  version of the id when it does not. Never a bare snake_case token. */
export function capabilityDisplayName(id: string): string {
  return CAPABILITY_NAMES[id] ?? humanizeId(id);
}

/** Display names that read as PLURAL — attention sentences must agree
 *  with them ("Notifications are unavailable", never "Notifications
 *  is"). Unknown ids default to singular grammar. */
const PLURAL_CAPABILITIES = new Set([
  "deployment",
  "secrets",
  "service_validation",
  "update_discovery",
  "notifications",
  "scheduler",
  "homelab_settings",
  "homelab_secrets",
  "homelab_resources",
]);

/** One honest sentence per degraded status — no cheerleading, and no
 *  failure softened into "looks fine" (contract principle 3). The
 *  `stale`/`unknown` heads ("word", "state") are singular regardless
 *  of the name and need no agreement. */
const ATTENTION_STATUS_PHRASES: Record<
  string,
  (name: string, plural: boolean) => string
> = {
  needs_attention: (n, p) => `${n} ${p ? "need" : "needs"} your attention.`,
  warning: (n, p) => `${n} ${p ? "are" : "is"} reporting a warning.`,
  unavailable: (n, p) => `${n} ${p ? "are" : "is"} unavailable.`,
  stale: (n) => `The latest word from ${n} is out of date.`,
  unknown: (n) => `The state of ${n} is unknown.`,
  disabled: (n, p) => `${n} ${p ? "are" : "is"} turned off.`,
  not_configured: (n, p) => `${n} ${p ? "are" : "is"} not set up yet.`,
};

/**
 * `reasoning` is optional by contract — "Memory opens instantly with
 * every model turned off" — so every degraded assistant line states
 * that fact plainly alongside the status, instead of reading like a
 * failure that matters.
 */
const REASONING_PHRASES: Record<string, string> = {
  needs_attention:
    "The assistant needs your attention — nothing depends on it.",
  warning: "The assistant is reporting a warning — nothing depends on it.",
  unavailable: "The assistant is off — nothing depends on it.",
  stale: "The assistant's last word is out of date — nothing depends on it.",
  unknown: "The assistant's state is unknown — nothing depends on it.",
  disabled: "The assistant is off — nothing depends on it.",
  not_configured: "There is no assistant set up — nothing depends on it.",
};

/** A line shaped like "<id>: <rest>" — what the loop's warnings are. */
const ATTENTION_LINE = /^([a-z][a-z0-9_]*): (.+)$/;
/** "<status> — <note>": a status carrying the loop's extra words. */
const ATTENTION_STATUS_NOTE = /^([a-z_]+) [—–] (.+)$/;

function humanizeId(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface PlainAttention {
  /** The human sentence rendered on the card — never a bare id. */
  headline: string;
  /** The raw server string, kept reachable behind the card's detail
   * disclosure whenever the headline is a translation. */
  technical?: string;
}

export function plainAttention(text: string): PlainAttention {
  const line = ATTENTION_LINE.exec(text);
  if (!line) return { headline: text };
  const [, id, rest] = line;
  const name = CAPABILITY_NAMES[id] ?? humanizeId(id);
  const note = ATTENTION_STATUS_NOTE.exec(rest);
  const status = note ? note[1] : rest;
  const extra = note ? note[2] : "";
  const phrase =
    (id === "reasoning" ? REASONING_PHRASES[status] : undefined) ??
    ATTENTION_STATUS_PHRASES[status]?.(name, PLURAL_CAPABILITIES.has(id));
  if (phrase) {
    const headline = extra
      ? `${phrase.replace(/\.$/, "")} — ${extra}${/[.!?]$/.test(extra) ? "" : "."}`
      : phrase;
    return { headline, technical: text };
  }
  // Free-text tail ("stale digest", a prose action line): keep the
  // station's own words; only swap a machine id for its human name.
  const headline = name === id ? text : `${name}: ${rest}`;
  return headline === text ? { headline } : { headline, technical: text };
}

// ─── World Area ─────────────────────────────────────────
//
// The navigation model is the owner-approved skeleton from
// docs/PRODUCT-LANGUAGE.md:
//
//   Overview · Memory · Chat · Settings   (the stable skeleton)
//   + personal sections (chosen/ordered/hidden via /api/sections)
//
// The four skeleton landmarks are NON-REARRANGEABLE: they are a
// module constant, always rendered first, always visible. No server
// layout, theme, or customization path can move or hide them —
// that is the council's landmark-stability rule (C3/Δ3) and what
// makes customization safe on a low-capacity day.
//
// There is no router, so a WorldArea carries no URL: activation is
// always state-driven (setActiveArea), never a fake href. The old
// `href` fields pointed at URLs nothing served — removing them here
// removes that trap class entirely.

/** The four contract landmarks, in fixed order. */
export type SkeletonAreaId = "overview" | "memory" | "chat" | "settings";

/** Destinations the person orders/hides via the /api/sections layout. */
export type PersonalAreaId = "interests" | "projects" | "systems";

export type WorldAreaId = SkeletonAreaId | PersonalAreaId;

export interface WorldArea {
  id: WorldAreaId;
  label: string;
}

/**
 * The stable skeleton — theme-proof, customization-proof. The labels
 * are the contract's product language ("Overview", not "Today";
 * "Memory" for the journal+records place; "Chat" is a shortcut here,
 * never the only door anywhere else).
 */
export const SKELETON_AREAS: readonly WorldArea[] = [
  { id: "overview", label: "Bridge" },
  { id: "memory", label: "Memory" },
  { id: "chat", label: "Chat" },
  { id: "settings", label: "Settings" },
];

/**
 * The rest of what this UI can route to. "systems" keeps its internal
 * id (it mirrors nothing on the server); its label follows the
 * contract word for the attached machine — **Computer**, never
 * "Node"/"Systems" in the UI.
 */
export const PERSONAL_AREAS: readonly WorldArea[] = [
  { id: "interests", label: "Interests" },
  { id: "projects", label: "Projects" },
  { id: "systems", label: "Computers" },
];

export const SKELETON_AREA_IDS: readonly SkeletonAreaId[] = SKELETON_AREAS.map(
  (a) => a.id as SkeletonAreaId,
);

/** The minimal server-row shape this derivation needs (a structural
 * subset of contract.ts SectionRow — GET /api/sections data.sections). */
export interface ServerSectionLike {
  id: string;
  order?: number;
  visible?: boolean;
}

/**
 * Derive the personal section nav list from the server layout.
 *
 * The server registry (src/personal_world/sections.py) names its own
 * core ids — today, journal, chat, settings. Those map onto OUR
 * landmarks and are therefore IGNORED here: the skeleton is pinned
 * client-side, so a server row that hides or reorders "today" or
 * "journal" changes nothing about Overview or Memory. Server ids the
 * UI has no destination for (media, lab, vault) are skipped.
 *
 * Guarantees (each is unit-tested):
 *  • landmarks never appear in, or are affected by, this list;
 *  • visible personal sections follow the server's order;
 *  • hidden personal sections drop out — but only personal ones;
 *  • a known destination the server has never advertised is appended
 *    at the tail — navigation destinations are never silently lost.
 */
export function derivePersonalAreas(
  serverSections?: readonly ServerSectionLike[] | null,
): WorldArea[] {
  if (!serverSections || serverSections.length === 0) {
    return [...PERSONAL_AREAS];
  }
  const byId = new Map<string, WorldArea>(
    [...SKELETON_AREAS, ...PERSONAL_AREAS].map((a) => [a.id, a]),
  );
  const out: WorldArea[] = [];
  const seen = new Set<string>();
  for (const s of [...serverSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const area = byId.get(s.id);
    if (area === undefined) continue; // server section with no UI destination
    if (seen.has(area.id)) continue; // duplicate row — first occurrence wins
    seen.add(area.id);
    if ((SKELETON_AREA_IDS as readonly string[]).includes(area.id)) continue;
    if (s.visible === false) continue; // hidden PERSONAL section — landmarks were never in this path
    out.push(area);
  }
  for (const area of PERSONAL_AREAS) {
    if (!seen.has(area.id)) out.push(area);
  }
  return out;
}

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

// ─── Overview screen (implementation keeps the "today" name) ──

/**
 * The composed Overview view (product word: Overview; the server
 * digest behind it is /api/daily, and this internal type keeps its
 * historical Today name per the contract's note that implementation
 * concepts may remain underneath). Single canonical UI shape;
 * `useTodaySummary`
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
  /** Raw server string, rendered behind the card's detail disclosure
   * only when the title is a plain-language translation of it. */
  technical?: string;
}

export interface CapabilitySummary {
  id: string;
  name: string;
  status: CapabilityStatus;
  summary?: string;
}
