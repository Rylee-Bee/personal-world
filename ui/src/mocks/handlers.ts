/**
 * MSW Handlers — Reproducible API states for Storybook and testing.
 *
 * Each handler map represents a world state:
 *   quiet    — everything healthy, nothing needs attention
 *   goodnews — a friendly signal, all systems go
 *   waiting  — something needs the user's input
 *   stale    — a capability hasn't checked in
 *   unavailable — a capability is down
 *   offline  — nothing connected
 *   empty    — fresh install, no data yet
 */

import { http, HttpResponse } from "msw";

type CapabilityStatus =
  | "healthy"
  | "needs_attention"
  | "unavailable"
  | "stale"
  | "unknown"
  | "disabled"
  | "not_configured";

interface Capability {
  name: string;
  status: CapabilityStatus;
  ok?: boolean;
  message?: string;
}

interface CompanionStatus {
  id: string;
  name: string;
  role?: string;
  artwork_url?: string;
  current_state?: string;
}

// ─── Capability sets ──────────────────────────────────────────────────────

const CAPABILITIES_QUIET: Capability[] = [
  { name: "source_control", status: "healthy", message: "All repositories synced" },
  { name: "discovery", status: "healthy", message: "Feed current" },
  { name: "journal", status: "healthy", message: "3 entries today" },
  { name: "vault", status: "healthy", message: "Secrets encrypted" },
];

const CAPABILITIES_GOODNEWS: Capability[] = [
  ...CAPABILITIES_QUIET,
  { name: "deployment", status: "healthy", message: "Deployed 2 hours ago" },
];

const CAPABILITIES_WAITING: Capability[] = [
  { name: "source_control", status: "needs_attention", message: "2 pull requests waiting for review" },
  { name: "discovery", status: "healthy", message: "Found 3 new items matching your interests" },
  { name: "journal", status: "healthy", message: "2 entries today" },
  { name: "vault", status: "healthy", message: "Secrets encrypted" },
];

const CAPABILITIES_STALE: Capability[] = [
  { name: "source_control", status: "healthy", message: "All repositories synced" },
  { name: "discovery", status: "stale", message: "Last checked 3 days ago" },
  { name: "journal", status: "healthy", message: "1 entry today" },
  { name: "vault", status: "healthy", message: "Secrets encrypted" },
];

const CAPABILITIES_UNAVAILABLE: Capability[] = [
  { name: "source_control", status: "unavailable", message: "Cannot reach remote" },
  { name: "discovery", status: "healthy", message: "Feed current" },
  { name: "journal", status: "healthy", message: "No entries today" },
  { name: "vault", status: "healthy", message: "Secrets encrypted" },
];

const CAPABILITIES_OFFLINE: Capability[] = [
  { name: "source_control", status: "disabled", message: "Not configured" },
  { name: "discovery", status: "disabled", message: "Not configured" },
  { name: "journal", status: "disabled", message: "Not configured" },
  { name: "vault", status: "not_configured", message: "No vault key" },
];

const CAPABILITIES_EMPTY: Capability[] = [];

// ─── Resident ─────────────────────────────────────────────────────────────

const RESIDENT_DEFAULT: CompanionStatus = {
  id: "renai",
  name: "Renai",
  role: "World Keeper",
  artwork_url: "/assets/characters/renai.png",
  current_state: "rest",
};

// ─── Handler builders ─────────────────────────────────────────────────────

function buildHandlers(capabilities: Capability[], resident?: CompanionStatus) {
  return [
    http.get("/api/health/capabilities", () => {
      return HttpResponse.json({ capabilities });
    }),

    http.get("/api/companion/status", () => {
      return HttpResponse.json({ resident: resident || RESIDENT_DEFAULT });
    }),

    http.get("/api/journal/entries", () => {
      return HttpResponse.json({ entries: [] });
    }),

    http.get("/api/projects", () => {
      return HttpResponse.json({ projects: [] });
    }),

    http.get("/api/interests", () => {
      return HttpResponse.json({ interests: [] });
    }),
  ];
}

// ─── Named handler sets ───────────────────────────────────────────────────

export const handlers = {
  quiet: buildHandlers(CAPABILITIES_QUIET),
  goodnews: buildHandlers(CAPABILITIES_GOODNEWS),
  waiting: buildHandlers(CAPABILITIES_WAITING),
  stale: buildHandlers(CAPABILITIES_STALE),
  unavailable: buildHandlers(CAPABILITIES_UNAVAILABLE),
  offline: buildHandlers(CAPABILITIES_OFFLINE),
  empty: buildHandlers(CAPABILITIES_EMPTY),
};

export type HandlerSet = keyof typeof handlers;
