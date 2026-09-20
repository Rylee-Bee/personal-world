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

interface JournalEntry {
  id: string;
  kind: "entry" | "correction" | "supersession";
  content: string;
  timestamp: string;
  superseded_by: string | null;
  metadata?: Record<string, never>;
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

// ─── Screen-specific handler sets ─────────────────────────────────────────

/** Journal — list and history endpoints */
function buildJournalHandlers(entries: JournalEntry[]) {
  return [
    http.get("/api/journal", () => {
      return HttpResponse.json({ entries });
    }),
    http.get("/api/journal/history", () => {
      return HttpResponse.json({ history: entries });
    }),
    http.post("/api/journal/supersede", () => {
      return HttpResponse.json({ ok: true });
    }),
    http.get("/api/status", () => {
      return HttpResponse.json({
        capabilities: {
          journal: { status: "healthy" },
          vault: { status: "healthy" },
        },
      });
    }),
    http.get("/api/auth/session", () => {
      return HttpResponse.json({ authenticated: true, principal: "Rylee" });
    }),
  ];
}

/** Vault — direct fetch endpoints used by the Vault screen */
function buildVaultHandlers(
  vaultStatus: { locked: boolean; encrypted: boolean; secret_count: number },
  secretNames: string[],
) {
  return [
    http.get("/api/vault/status", () => {
      return HttpResponse.json(vaultStatus);
    }),
    http.get("/api/vault/names", () => {
      return HttpResponse.json(secretNames);
    }),
    http.post("/api/vault/unlock", () => {
      return HttpResponse.json({ ok: true });
    }),
    http.post("/api/vault/lock", () => {
      return HttpResponse.json({ ok: true });
    }),
    http.post("/api/vault/set", () => {
      return HttpResponse.json({ ok: true });
    }),
    http.get("/api/status", () => {
      return HttpResponse.json({
        capabilities: {
          vault: { status: vaultStatus.locked ? "not_configured" : "healthy" },
          source_control: { status: "healthy" },
        },
      });
    }),
    http.get("/api/auth/session", () => {
      return HttpResponse.json({ authenticated: true, principal: "Rylee" });
    }),
  ];
}

/** Settings — session, brain, manifest, status */
function buildSettingsHandlers() {
  return [
    http.get("/api/status", () => {
      return HttpResponse.json({
        capabilities: {
          source_control: { status: "healthy" },
          discovery: { status: "healthy" },
          journal: { status: "healthy" },
          vault: { status: "stale", warnings: ["Last backup 7 days ago"] },
        },
      });
    }),
    http.get("/api/auth/session", () => {
      return HttpResponse.json({ authenticated: true, principal: "Rylee" });
    }),
    http.get("/api/brain/templates", () => {
      return HttpResponse.json({
        templates: [
          { id: "daily-digest", kind: "digest", surface: "today" },
          { id: "journal-prompt", kind: "prompt", surface: "journal" },
        ],
      });
    }),
    http.get("/api/manifest", () => {
      return HttpResponse.json({ version: "0.1.0", endpoints: [] });
    }),
    http.get("/api/identity/principal", () => {
      return HttpResponse.json({ display_name: "Rylee" });
    }),
  ];
}

/** Chat — history and providers */
function buildChatHandlers(
  messages: Array<{ role: string; content: string; timestamp?: string }>,
  providers?: Array<{ id: string; name: string; available: boolean }>,
) {
  return [
    http.get("/api/chat/history", () => {
      return HttpResponse.json({ messages });
    }),
    http.get("/api/chat/providers", () => {
      return HttpResponse.json({
        providers: providers ?? [
          { id: "default", name: "Default", available: true },
          { id: "openai", name: "OpenAI", available: true },
        ],
      });
    }),
    http.post("/api/chat", () => {
      return HttpResponse.json({ ok: true });
    }),
  ];
}

// ─── Named handler sets ───────────────────────────────────────────────────

const JOURNAL_ENTRIES_EMPTY: JournalEntry[] = [];

const JOURNAL_ENTRIES_POPULATED: JournalEntry[] = [
  {
    id: "j-001",
    kind: "entry",
    content: "Started working on the new onboarding flow. The wireframes look solid — need to review accessibility before implementation.",
    timestamp: "2026-09-19T10:30:00Z",
    superseded_by: null,
  },
  {
    id: "j-002",
    kind: "entry",
    content: "Reviewed the vault encryption approach. Using AES-256-GCM for at-rest secrets. The key derivation uses Argon2id.",
    timestamp: "2026-09-19T14:15:00Z",
    superseded_by: null,
  },
  {
    id: "j-003",
    kind: "correction",
    content: "Previous entry about the database choice was inaccurate — we're using SQLite for local storage, not PostgreSQL.",
    timestamp: "2026-09-19T16:00:00Z",
    superseded_by: null,
  },
  {
    id: "j-004",
    kind: "supersession",
    content: "This entry replaces the earlier draft. The project timeline has shifted by two weeks.",
    timestamp: "2026-09-18T09:00:00Z",
    superseded_by: "j-002",
  },
];

const CHAT_MESSAGES_EMPTY: Array<{ role: string; content: string; timestamp?: string }> = [];

const CHAT_MESSAGES_POPULATED: Array<{ role: string; content: string; timestamp?: string }> = [
  {
    role: "user",
    content: "Hey Renai, how are the systems looking today?",
    timestamp: "2026-09-19T10:00:00Z",
  },
  {
    role: "assistant",
    content: "All systems are healthy! The vault is encrypted and locked, journal has 3 entries today, and the discovery feed is current. Nothing needs your attention right now.",
    timestamp: "2026-09-19T10:00:05Z",
  },
  {
    role: "user",
    content: "Great. Can you give me a summary of recent journal entries?",
    timestamp: "2026-09-19T10:01:00Z",
  },
  {
    role: "assistant",
    content: "You have 3 active entries today: one about the onboarding flow work, one on vault encryption architecture, and a correction about the database choice. The supersession entry from yesterday has been archived.",
    timestamp: "2026-09-19T10:01:03Z",
  },
];

const VAULT_LOCKED = { locked: true, encrypted: true, secret_count: 3 };
const VAULT_UNLOCKED = { locked: false, encrypted: true, secret_count: 3 };
const VAULT_UNLOCKED_EMPTY = { locked: false, encrypted: true, secret_count: 0 };
const VAULT_SECRET_NAMES = ["API_KEY", "DATABASE_URL", "SECRET_TOKEN"];

export const handlers = {
  // ─── Today screen states ─────────────────────────────
  quiet: buildHandlers(CAPABILITIES_QUIET),
  goodnews: buildHandlers(CAPABILITIES_GOODNEWS),
  waiting: buildHandlers(CAPABILITIES_WAITING),
  stale: buildHandlers(CAPABILITIES_STALE),
  unavailable: buildHandlers(CAPABILITIES_UNAVAILABLE),
  offline: buildHandlers(CAPABILITIES_OFFLINE),
  empty: buildHandlers(CAPABILITIES_EMPTY),

  // ─── Journal screen states ───────────────────────────
  journalEmpty: buildJournalHandlers(JOURNAL_ENTRIES_EMPTY),
  journalPopulated: buildJournalHandlers(JOURNAL_ENTRIES_POPULATED),

  // ─── Vault screen states ─────────────────────────────
  vaultLocked: buildVaultHandlers(VAULT_LOCKED, []),
  vaultUnlocked: buildVaultHandlers(VAULT_UNLOCKED, VAULT_SECRET_NAMES),
  vaultUnlockedEmpty: buildVaultHandlers(VAULT_UNLOCKED_EMPTY, []),

  // ─── Settings screen states ──────────────────────────
  settingsDefault: buildSettingsHandlers(),

  // ─── Chat screen states ──────────────────────────────
  chatEmpty: buildChatHandlers(CHAT_MESSAGES_EMPTY),
  chatPopulated: buildChatHandlers(CHAT_MESSAGES_POPULATED),
};

export type HandlerSet = keyof typeof handlers;
