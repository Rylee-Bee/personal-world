/**
 * Overview — daily home loop logic (TRUE-NORTH, Wave 1 Lane A).
 *
 * Pure, deterministic helpers for the four loop beats that live on
 * this screen: Orient (Keeper greet), Resume (thread), Discover
 * (sliver) and the parked Projects ruling (deterministic path from
 * source to details). No React, no fetches — every function here is
 * unit-tested against the server shapes in src/data/contract.ts.
 *
 * Honesty floor (docs/PRODUCT-LANGUAGE.md principle 3): unknown stays
 * unknown, absent stays absent. No function in this file invents a
 * value the server did not send.
 */

import type {
  Envelope,
  JournalEvent,
  ProjectsStatusData,
  ProjectStatusRow,
} from "../../data/contract";

// ─── Orient: the World Keeper greet ─────────────────────────────────
//
// The six canonical states of design/handoff/WORLD_KEEPER.md. The
// Keeper is the heartbeat, never telemetry (§7.1): the state chosen
// here depends on NOTHING but the clock — never on capability status,
// health, or attention.

export type KeeperState =
  | "idle"
  | "hello"
  | "listening"
  | "thinking"
  | "celebrate"
  | "sleep";

export const KEEPER_STATES: readonly KeeperState[] = [
  "idle",
  "hello",
  "listening",
  "thinking",
  "celebrate",
  "sleep",
];

/**
 * The greet pose for a local hour (0-23), deterministic:
 * night hours (21:00-05:59) → `sleep` (WORLD_KEEPER.md: night mode);
 * every other hour → `hello` (the greeting moment — app launch /
 * return after absence). The other four states belong to assistant
 * interaction, which Overview never triggers on its own.
 */
export function keeperStateForHour(hour: number): KeeperState {
  const h = Math.floor(hour);
  if (h >= 21 || h < 6) return "sleep";
  return "hello";
}

/** The greet line itself — same hours as the pose, one warm word. */
export function greetForHour(hour: number): string {
  const h = Math.floor(hour);
  if (h < 6) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

// ─── Resume: yesterday's thread ─────────────────────────────────────

/**
 * The newest journal event is the thread to pick back up
 * (GET /api/journal answers current versions, newest first). Absent
 * list → null, never a placeholder.
 */
export function newestThread(
  envelope: Envelope<JournalEvent[]> | undefined,
): JournalEvent | null {
  const events = envelope?.ok === true ? envelope.data : undefined;
  if (!Array.isArray(events) || events.length === 0) return null;
  return events[0] ?? null;
}

/** "Sep 19, 4:00 PM" — a local, human when-line for the thread. */
export function threadWhen(ts: string): string {
  const when = new Date(ts);
  if (Number.isNaN(when.getTime())) return "at an unknown time";
  return when.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Discover: the brought-to-you sliver ────────────────────────────
//
// The mixtape pattern (TRUE-NORTH): small batch, earned cadence, pull
// by default. Overview ships the SLOT; the honest empty state is a
// first-class render, not a failure.

export type DiscoverySliverState =
  /** The station answered, but no source is configured yet. */
  | { kind: "no-source" }
  /** Sources configured; nothing picked for you yet. */
  | { kind: "listening"; sources: number }
  /** A small batch is waiting in Interests. */
  | { kind: "waiting"; items: number }
  /** The capability could not be read — said plainly. */
  | { kind: "unavailable" };

interface DiscoveryStatusLike {
  sources?: unknown;
  items?: unknown;
  source_count?: unknown;
  item_count?: unknown;
}

export function discoverySliverState(
  envelope: Envelope<DiscoveryStatusLike> | undefined,
  isError: boolean,
): DiscoverySliverState {
  if (isError) return { kind: "unavailable" };
  if (envelope === undefined) return { kind: "unavailable" };
  if (envelope.ok !== true || envelope.data === undefined) {
    return { kind: "unavailable" };
  }
  const data = envelope.data;
  const sources =
    typeof data.source_count === "number"
      ? data.source_count
      : Array.isArray(data.sources)
        ? data.sources.length
        : 0;
  const items =
    typeof data.item_count === "number"
      ? data.item_count
      : Array.isArray(data.items)
        ? data.items.length
        : 0;
  if (sources === 0) return { kind: "no-source" };
  if (items === 0) return { kind: "listening", sources };
  return { kind: "waiting", items };
}

// ─── Projects: deterministic path from source to details ───────────
//
// Owner refinement 2 (TRUE-NORTH): Projects stays parked as a full
// surface, but every Overview status row links to its authoritative
// source — agent-sync's observation names the Git remote, and Git
// owns Git truth.

export interface ProjectRowView {
  key: string;
  name: string;
  branch: string | null;
  /** Honest words for publish_state; null state → unknown words. */
  publishWords: string;
  workWords: string;
  safeWords: string;
  /** The authoritative source link (the Git remote), when known. */
  sourceUrl: string | null;
  /** agent-sync's own per-repo error text, when it isolated one. */
  errorText: string | null;
  /** Unpushed/untracked counts, only when any are non-zero. */
  openWork: string | null;
}

const PUBLISH_WORDS: Record<string, string> = {
  match: "in step with its remote",
  ahead: "ahead of its remote",
  behind: "behind its remote",
  diverged: "diverged from its remote",
};

const WORK_WORDS: Record<string, string> = {
  working: "work in progress",
  waiting_for_help: "waiting for help",
  verifying: "verifying",
  complete: "complete",
  blocked: "blocked",
  deferred: "deferred",
  unknown: "state unknown",
};

const SAFE_WORDS: Record<string, string> = {
  yes: "safe to leave",
  "published-with-local-work": "published, with local work still open",
  no: "not safe to leave",
  unknown: "leave-safety unknown",
};

export function projectRowView(row: ProjectStatusRow): ProjectRowView {
  const tree = row.working_tree;
  const openParts = [
    tree.staged > 0 ? `${tree.staged} staged` : null,
    tree.modified > 0 ? `${tree.modified} modified` : null,
    tree.untracked > 0 ? `${tree.untracked} untracked` : null,
    tree.conflicted > 0 ? `${tree.conflicted} conflicted` : null,
  ].filter((part): part is string => part !== null);
  return {
    key: row.path ?? row.project,
    name: row.project,
    branch: row.branch,
    publishWords:
      (row.publish_state !== null && PUBLISH_WORDS[row.publish_state]) ||
      "publication state unknown",
    workWords: WORK_WORDS[row.work_state] ?? row.work_state,
    safeWords: SAFE_WORDS[row.safe_to_leave] ?? "leave-safety unknown",
    sourceUrl: row.remote_url,
    errorText: row.error,
    openWork: openParts.length > 0 ? openParts.join(", ") : null,
  };
}

export type ProjectsViewState =
  /** agent-sync absent / timed out / malformed — said plainly. */
  | { kind: "unavailable"; warning: string | null }
  /** The sensor answered with an empty registry. */
  | { kind: "empty" }
  /** Dated rows, each linking to its authoritative source. */
  | {
      kind: "rows";
      rows: ProjectRowView[];
      observedLabel: string | null;
      freshnessWords: string;
    };

const FRESHNESS_WORDS: Record<string, string> = {
  fresh: "a fresh observation",
  stale: "an out-of-date observation",
  unknown: "an observation of unknown age",
};

export function projectsViewState(
  envelope: Envelope<ProjectsStatusData> | undefined,
  isError: boolean,
): ProjectsViewState {
  if (isError) return { kind: "unavailable", warning: null };
  if (envelope === undefined) return { kind: "unavailable", warning: null };
  if (envelope.ok !== true || envelope.data === undefined) {
    return {
      kind: "unavailable",
      warning: envelope.warnings?.[0] ?? null,
    };
  }
  const data = envelope.data;
  const projects = Array.isArray(data.projects) ? data.projects : [];
  if (projects.length === 0) return { kind: "empty" };
  const observed = data.observed_at ? new Date(data.observed_at) : null;
  return {
    kind: "rows",
    rows: projects.map(projectRowView),
    observedLabel:
      observed && !Number.isNaN(observed.getTime())
        ? observed.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : null,
    freshnessWords:
      FRESHNESS_WORDS[data.freshness] ?? FRESHNESS_WORDS.unknown,
  };
}
