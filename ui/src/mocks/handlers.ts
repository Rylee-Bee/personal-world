/**
 * MSW Handlers — Reproducible API states for Storybook and testing.
 *
 * Endpoint paths and response bodies mirror what src/data/hooks.ts
 * actually fetches (via src/data/api.ts + src/generated/openapi.json):
 *   GET  /healthz               {ok, auth_configured, setup_needed}
 *   GET  /api/status            {world?, capabilities, actors?}
 *   GET  /api/daily             {summary, reminders[], journal_recent[], projects[]}
 *   GET  /api/actors            {actors: [{id, name, type, status}]}
 *   GET  /api/journal           {entries, total, limit, offset}
 *   GET  /api/journal/history   {history}
 *   GET  /api/chat/history      {messages}
 *   GET  /api/chat/providers    {providers}
 *   GET/PUT /api/prefs          {ok, data}
 *   GET/PUT /api/sections       {ok, data:{sections}}
 *   GET  /api/vault/status      {ok, data:{locked, encrypted, warning?}}
 *   GET  /api/vault/names       {ok, data:{names}} (409 while locked)
 *   POST /api/vault/unlock|lock|set, DELETE /api/vault/{name}
 *
 * World-state sets (quiet, goodnews, waiting, stale, unavailable,
 * offline, empty) drive /api/status + /api/daily + /api/actors, which is
 * what Today composes through useTodaySummary().
 *
 * Screen sets are STATEFUL per creation (see createHandlers) so the
 * Vault and Chat stories behave like the real screen inside Storybook:
 * unlock reveals the list, sends append to the transcript.
 */

import { http, HttpResponse, type RequestHandler } from "msw";

// ─── Fixtures ────────────────────────────────────────────────────────────

const RESIDENT = {
  id: "renai",
  name: "Renai",
  type: "companion",
  status: "rest",
};

type CapMap = Record<string, { status: string; warnings?: string[] }>;

const CAPS_QUIET: CapMap = {
  source_control: { status: "healthy" },
  discovery: { status: "healthy" },
  journal: { status: "healthy" },
  vault: { status: "healthy" },
};

const CAPS_WAITING: CapMap = {
  source_control: { status: "needs_attention", warnings: ["2 pull requests waiting for review"] },
  discovery: { status: "healthy" },
  journal: { status: "healthy" },
  vault: { status: "healthy" },
};

const CAPS_STALE: CapMap = {
  source_control: { status: "healthy" },
  discovery: { status: "stale", warnings: ["Last checked 3 days ago"] },
  journal: { status: "healthy" },
  vault: { status: "healthy" },
};

const CAPS_UNAVAILABLE: CapMap = {
  source_control: { status: "unavailable", warnings: ["Cannot reach remote"] },
  discovery: { status: "healthy" },
  journal: { status: "healthy" },
  vault: { status: "healthy" },
};

const CAPS_OFFLINE: CapMap = {
  source_control: { status: "disabled", warnings: ["Not configured"] },
  discovery: { status: "disabled", warnings: ["Not configured"] },
  journal: { status: "disabled", warnings: ["Not configured"] },
  vault: { status: "not_configured", warnings: ["No vault key"] },
};

interface WorldState {
  capabilities: CapMap;
  reminders: Array<{ text: string }>;
  actors: unknown[];
  extraHealthy: boolean;
}

const WORLD_STATES: Record<string, WorldState> = {
  quiet: {
    capabilities: CAPS_QUIET,
    reminders: [],
    actors: [RESIDENT],
    extraHealthy: false,
  },
  goodnews: {
    capabilities: { ...CAPS_QUIET, deployment: { status: "healthy" } },
    reminders: [],
    actors: [RESIDENT],
    extraHealthy: true,
  },
  waiting: {
    capabilities: CAPS_WAITING,
    reminders: [{ text: "Reply to Renai's digest proposal" }],
    actors: [RESIDENT],
    extraHealthy: false,
  },
  stale: {
    capabilities: CAPS_STALE,
    reminders: [],
    actors: [RESIDENT],
    extraHealthy: false,
  },
  unavailable: {
    capabilities: CAPS_UNAVAILABLE,
    reminders: [{ text: "Source control cannot reach the remote" }],
    actors: [RESIDENT],
    extraHealthy: false,
  },
  offline: {
    capabilities: CAPS_OFFLINE,
    reminders: [],
    actors: [],
    extraHealthy: false,
  },
  empty: {
    capabilities: {},
    reminders: [],
    actors: [],
    extraHealthy: false,
  },
};

// ─── Journal fixtures ────────────────────────────────────────────────────

interface JournalEntry {
  id: string;
  kind: "entry" | "correction" | "supersession";
  content: string;
  timestamp: string;
  superseded_by: string | null;
}

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
    content: "Reviewed the vault encryption approach. Key derivation is deliberately not mirrored here — never put live material into fixtures.",
    timestamp: "2026-09-19T14:15:00Z",
    superseded_by: null,
  },
  {
    id: "j-003",
    kind: "correction",
    content: "Previous entry about the database choice was inaccurate — local storage is SQLite, not PostgreSQL.",
    timestamp: "2026-09-19T16:00:00Z",
    superseded_by: null,
  },
];

// ─── Chat fixtures ───────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

const CHAT_SEED: ChatMessage[] = [
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
];

// ─── Vault fixture state ─────────────────────────────────────────────────

const SECRET_NAMES_SEED = ["API_KEY", "DATABASE_URL", "SECRET_TOKEN"];

// ─── Shared baseline handlers (health + session) ─────────────────────────

function baselineHandlers(): RequestHandler[] {
  return [
    http.get("/healthz", () =>
      HttpResponse.json({ ok: true, auth_configured: true, setup_needed: false }),
    ),
    http.get("/api/auth/session", () =>
      HttpResponse.json({ authenticated: true, principal: "Rylee", step_up: true }),
    ),
  ];
}

// ─── Stateful per-screen builders ────────────────────────────────────────

/**
 * Today-family world state. Fresh handlers per call so a story remount
 * resets server fiction to its documented starting point.
 */
function buildWorldHandlers(stateName: keyof typeof WORLD_STATES | string): RequestHandler[] {
  const world = WORLD_STATES[stateName] ?? WORLD_STATES.quiet;
  return [
    ...baselineHandlers(),
    http.get("/api/status", () =>
      HttpResponse.json({
        world: { name: "Station", state: stateName },
        capabilities: world.capabilities,
        actors: { actors: world.actors },
      }),
    ),
    http.get("/api/daily", () =>
      HttpResponse.json({
        summary:
          world.reminders.length > 0
            ? `${world.reminders.length} thing(s) waiting when you're ready.`
            : "A quiet day on the station.",
        reminders: world.reminders,
        journal_recent: [],
        projects: [],
      }),
    ),
    http.get("/api/actors", () => HttpResponse.json({ actors: world.actors })),
    // The App shell consumes section order; the world sets keep the
    // default ordering so readouts match the story name.
    http.get("/api/sections", () =>
      HttpResponse.json({ ok: true, data: { schema: "sections.v1", sections: [] } }),
    ),
  ];
}

function buildJournalHandlers(entries: JournalEntry[]): RequestHandler[] {
  // Mutable copy so posting a new entry behaves live within a story mount.
  let current = [...entries];
  return [
    ...baselineHandlers(),
    http.get("/api/status", () =>
      HttpResponse.json({
        capabilities: { journal: { status: "healthy" }, vault: { status: "healthy" } },
      }),
    ),
    http.get("/api/journal", () =>
      HttpResponse.json({ entries: current, total: current.length, limit: 50, offset: 0 }),
    ),
    http.get("/api/journal/history", () =>
      HttpResponse.json({ history: current }),
    ),
    http.post("/api/journal", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as {
        content?: string;
        kind?: string;
      };
      const entry: JournalEntry = {
        id: `j-${Date.now()}`,
        kind: (body.kind === "correction" ? "correction" : "entry") as JournalEntry["kind"],
        content: body.content ?? "",
        timestamp: new Date().toISOString(),
        superseded_by: null,
      };
      current = [entry, ...current];
      return HttpResponse.json({ ok: true, data: entry });
    }),
    http.post("/api/journal/supersede", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as {
        entry_id?: string;
        reason?: string;
      };
      const now = new Date().toISOString();
      const replacementId = `j-sup-${Date.now()}`;
      const next: JournalEntry[] = [];
      for (const e of current) {
        if (e.id === body.entry_id) {
          next.push({ ...e, superseded_by: replacementId });
          next.push({
            id: replacementId,
            kind: "supersession",
            content: body.reason ?? "Superseded.",
            timestamp: now,
            superseded_by: null,
          });
        } else {
          next.push(e);
        }
      }
      current = next;
      return HttpResponse.json({ ok: true });
    }),
  ];
}

/**
 * Vault state machine mock — honours the generated contract:
 * {name, value} bodies, {ok, data} envelopes, 409 on names while locked.
 */
function buildVaultHandlers(initial: {
  locked: boolean;
  encrypted: boolean;
  names: string[];
}): RequestHandler[] {
  let locked = initial.locked;
  let names = [...initial.names];
  const lockedResponse = () =>
    HttpResponse.json({ detail: "vault is locked" }, { status: 409 });
  return [
    ...baselineHandlers(),
    http.get("/api/status", () =>
      HttpResponse.json({
        capabilities: {
          vault: { status: locked ? "not_configured" : "healthy" },
          source_control: { status: "healthy" },
        },
      }),
    ),
    http.get("/api/vault/status", () =>
      HttpResponse.json({
        ok: true,
        data: { locked, encrypted: initial.encrypted },
      }),
    ),
    http.get("/api/vault/names", () => {
      if (locked) return lockedResponse();
      return HttpResponse.json({ ok: true, data: { names } });
    }),
    http.post("/api/vault/unlock", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { passphrase?: string };
      if (!body.passphrase) {
        return HttpResponse.json({ detail: "passphrase required" }, { status: 400 });
      }
      locked = false;
      return HttpResponse.json({ ok: true, status: "unlocked", data: {} });
    }),
    http.post("/api/vault/lock", () => {
      locked = true;
      return HttpResponse.json({ ok: true, data: { locked: true } });
    }),
    http.post("/api/vault/set", async ({ request }) => {
      if (locked) return lockedResponse();
      const body = (await request.json().catch(() => ({}))) as {
        name?: string;
        value?: string;
      };
      if (!body.name || body.value === undefined) {
        return HttpResponse.json({ detail: "name and value required" }, { status: 400 });
      }
      if (!names.includes(body.name)) names = [...names, body.name];
      return HttpResponse.json({ ok: true, data: { name: body.name } });
    }),
    http.delete("/api/vault/:name", ({ params }) => {
      if (locked) return lockedResponse();
      const name = String(params.name ?? "");
      names = names.filter((n) => n !== name);
      return HttpResponse.json({ ok: true, data: { name } });
    }),
  ];
}

function buildSettingsHandlers(): RequestHandler[] {
  return [
    ...baselineHandlers(),
    http.get("/api/status", () =>
      HttpResponse.json({
        capabilities: {
          source_control: { status: "healthy" },
          discovery: { status: "healthy" },
          journal: { status: "healthy" },
          vault: { status: "stale", warnings: ["Last backup 7 days ago"] },
        },
      }),
    ),
    http.get("/api/brain/templates", () =>
      HttpResponse.json({
        templates: [
          { id: "daily-digest", kind: "digest", surface: "today" },
          { id: "journal-prompt", kind: "prompt", surface: "journal" },
        ],
      }),
    ),
    http.get("/api/manifest", () =>
      HttpResponse.json({ version: "0.1.0", endpoints: [] }),
    ),
    http.get("/api/prefs", () =>
      HttpResponse.json({
        ok: true,
        data: { motion: false, contrast: "normal", density: "comfortable", text_scale: "default" },
      }),
    ),
    http.put("/api/prefs", async ({ request }) => {
      const body = await request.json().catch(() => ({}));
      return HttpResponse.json({ ok: true, data: body });
    }),
    http.get("/api/sections", () =>
      HttpResponse.json({
        ok: true,
        data: {
          schema: "sections.v1",
          sections: [
            { id: "today", label: "Today", order: 0, visible: true, kind: "core" },
            { id: "journal", label: "Journal", order: 1, visible: true, kind: "core" },
            { id: "records", label: "Records", order: 2, visible: true, kind: "core" },
            { id: "settings", label: "Settings", order: 3, visible: true, kind: "core" },
          ],
        },
      }),
    ),
    http.put("/api/sections", async ({ request }) => {
      const body = await request.json().catch(() => ({}));
      return HttpResponse.json({ ok: true, data: body });
    }),
    http.get("/api/identity/principal", () =>
      HttpResponse.json({ ok: true, data: { display_name: "Rylee" } }),
    ),
    http.put("/api/identity/principal", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { display_name?: string };
      return HttpResponse.json({ ok: true, data: { display_name: body.display_name } });
    }),
  ];
}

function buildChatHandlers(seed: ChatMessage[]): RequestHandler[] {
  let messages = [...seed];
  return [
    ...baselineHandlers(),
    http.get("/api/chat/history", () =>
      HttpResponse.json({ messages, count: messages.length }),
    ),
    http.get("/api/chat/providers", () =>
      HttpResponse.json({
        providers: [
          { id: "default", name: "Default", available: true },
          { id: "local", name: "Local model", available: true },
        ],
      }),
    ),
    http.post("/api/chat", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { message?: string };
      const now = new Date().toISOString();
      messages = [
        ...messages,
        { role: "user", content: body.message ?? "", timestamp: now },
        {
          role: "assistant",
          content: "Noted — this is a mock reply served by MSW, not a live model.",
          timestamp: now,
        },
      ];
      return HttpResponse.json({ ok: true });
    }),
  ];
}

function buildUnreachableHandlers(): RequestHandler[] {
  return [
    http.get("/healthz", () =>
      HttpResponse.json({ detail: "service unavailable" }, { status: 503 }),
    ),
    http.get("/api/*", () => HttpResponse.error()),
  ];
}

// ─── Named handler sets ──────────────────────────────────────────────────

type SetBuilder = () => RequestHandler[];

const builders = {
  // Today screen world states
  quiet: () => buildWorldHandlers("quiet"),
  goodnews: () => buildWorldHandlers("goodnews"),
  waiting: () => buildWorldHandlers("waiting"),
  stale: () => buildWorldHandlers("stale"),
  unavailable: () => buildWorldHandlers("unavailable"),
  offline: () => buildWorldHandlers("offline"),
  empty: () => buildWorldHandlers("empty"),

  // Journal screen states
  journalEmpty: () => buildJournalHandlers([]),
  journalPopulated: () => buildJournalHandlers(JOURNAL_ENTRIES_POPULATED),

  // Vault screen states
  vaultLocked: () =>
    buildVaultHandlers({ locked: true, encrypted: true, names: SECRET_NAMES_SEED }),
  vaultUnlocked: () =>
    buildVaultHandlers({ locked: false, encrypted: true, names: SECRET_NAMES_SEED }),
  vaultUnlockedEmpty: () =>
    buildVaultHandlers({ locked: false, encrypted: true, names: [] }),

  // Settings screen states
  settingsDefault: () => buildSettingsHandlers(),

  // Shell states — /healthz down, everything else fails
  unreachable: () => buildUnreachableHandlers(),

  // Chat screen states
  chatEmpty: () => buildChatHandlers([]),
  chatPopulated: () => buildChatHandlers(CHAT_SEED),
} satisfies Record<string, SetBuilder>;

export type HandlerSet = keyof typeof builders;

/** Build a FRESH (stateful) handler set — use this for story mounts so
 * each visit starts from the documented world state. */
export function createHandlers(name: HandlerSet | string): RequestHandler[] {
  const build = (builders as Record<string, SetBuilder | undefined>)[name];
  return build ? build() : [];
}

/** Pre-built singleton map — kept for the node server and as a stable
 * default. Prefer createHandlers() where mutation interplay matters. */
export const handlers: Record<HandlerSet, RequestHandler[]> = Object.fromEntries(
  Object.keys(builders).map((name) => [name, createHandlers(name)]),
) as Record<HandlerSet, RequestHandler[]>;
