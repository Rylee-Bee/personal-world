/**
 * MSW Handlers — Reproducible API states for Storybook and testing.
 *
 * Endpoint paths, envelopes and field names mirror the REAL server
 * (src/personal_world/api.py, verified 2026-09-20 — same day this file
 * was re-aligned):
 *   GET  /healthz               {ok, auth_configured, setup_needed, dev_bypass}
 *   GET  /api/status            {ok, status, data:{…summary, capabilities, actors[]}}
 *   GET  /api/daily             {ok, status, changed, warnings[], actions[],
 *                                data:{world, capabilities, attention[]}}
 *   GET  /api/actors            {ok, data:[Actor…]}   (provider staff directory)
 *   GET  /api/prefs             {ok, data:{motion, contrast, text_scale,
 *                                density, target_size, companion, accent}}
 *   GET  /api/journal?n         {ok, data:[JournalEvent…]}  (current versions)
 *   POST /api/journal           body {text} → {ok, data:{written}}
 *   POST /api/journal/supersede body {supersedes, text, reason?}
 *   GET  /api/journal/history?ts {ok, status, data:{entries}} (one chain)
 *   GET  /api/chat/history?n    {ok, data:{entries, count}}
 *   GET  /api/chat/providers    {ok, data:{providers, active}}
 *   POST /api/chat              {ok, status, …, data:{reply}}
 *   GET  /api/sections          {ok, data:{schema, sections}}
 *   PUT  /api/sections          body {order?, hidden?}
 *   GET  /api/vault/*           {ok, data} envelopes (409 names while locked)
 *
 * A JournalEvent here is model.JournalEvent: {ts, kind, summary,
 * provenance, classification, supersedes, supersede_reason} — the
 * pre-2026-09-20 {id, content, timestamp, superseded_by} fixtures
 * described a server that never existed.
 *
 * World-state sets (quiet, goodnews, waiting, stale, unavailable,
 * offline, empty) drive /api/status + /api/daily + /api/prefs, which
 * Today composes through useTodaySummary(); "attention" strings drive
 * the signals list.
 *
 * Screen sets are STATEFUL per creation (see createHandlers) so the
 * Vault and Chat stories behave like the real screen inside Storybook:
 * unlock reveals the list, sends append to the transcript.
 */

import { http, HttpResponse, type RequestHandler } from "msw";

// ─── Server-shaped fixtures ──────────────────────────────────────────

type CapabilityObservation = {
  ok: boolean;
  status: string;
  warnings: string[];
  last_observed: string;
};

type CapMap = Record<string, CapabilityObservation>;

const NOW = "2026-09-20T09:00:00Z";

function cap(
  status: CapabilityObservation["status"],
  warnings: string[] = [],
): CapabilityObservation {
  return { ok: status === "healthy", status, warnings, last_observed: NOW };
}

const CAPS_QUIET: CapMap = {
  source_control: cap("healthy"),
  discovery: cap("healthy"),
  journal: cap("healthy"),
  secrets: cap("healthy"),
};

const CAPS_WAITING: CapMap = {
  source_control: cap("needs_attention", ["2 pull requests waiting for review"]),
  discovery: cap("healthy"),
  journal: cap("healthy"),
  secrets: cap("healthy"),
};

const CAPS_STALE: CapMap = {
  source_control: cap("healthy"),
  discovery: cap("stale", ["Last checked 3 days ago"]),
  journal: cap("healthy"),
  secrets: cap("healthy"),
};

const CAPS_UNAVAILABLE: CapMap = {
  source_control: cap("unavailable", ["Cannot reach remote"]),
  discovery: cap("healthy"),
  journal: cap("healthy"),
  secrets: cap("healthy"),
};

const CAPS_OFFLINE: CapMap = {
  source_control: cap("disabled", ["Not configured"]),
  discovery: cap("disabled", ["Not configured"]),
  journal: cap("disabled", ["Not configured"]),
  secrets: cap("not_configured", ["No vault key"]),
};

/** A provider-staff-directory Actor (model.Actor — never a companion). */
function actor(name: string, role: string, status: string) {
  return {
    name,
    role,
    provider: name,
    capabilities: [role],
    status,
    secrets: "none",
    writes: "none",
  };
}

const PREFS_BASE = {
  motion: "reduced",
  contrast: "comfortable",
  text_scale: 1,
  density: "comfortable",
  target_size: 44,
  companion: "mermaid",
  accent: "world-keeper",
};

interface WorldState {
  capabilities: CapMap;
  attention: string[];
  companion: string;
}

const WORLD_STATES: Record<string, WorldState> = {
  quiet: { capabilities: CAPS_QUIET, attention: [], companion: "mermaid" },
  goodnews: {
    capabilities: { ...CAPS_QUIET, homelab_health: cap("healthy") },
    attention: [],
    companion: "mermaid",
  },
  waiting: {
    capabilities: CAPS_WAITING,
    attention: ["source_control: needs_attention — reply to the digest proposal"],
    companion: "mermaid",
  },
  stale: {
    capabilities: CAPS_STALE,
    attention: [],
    companion: "world-tree-squirrel",
  },
  unavailable: {
    capabilities: CAPS_UNAVAILABLE,
    attention: ["source_control: unavailable"],
    companion: "robot",
  },
  offline: {
    capabilities: CAPS_OFFLINE,
    attention: [],
    companion: "personal-world",
  },
  empty: { capabilities: {}, attention: [], companion: "personal-world" },
};

// ─── Journal fixtures (model.JournalEvent) ───────────────────────────

interface JournalEvent {
  ts: string;
  kind: string;
  summary: string;
  provenance: {
    source: string;
    observed_at: string;
    provider: string | null;
    authority: string;
  };
  classification: string;
  supersedes: string | null;
  supersede_reason: string | null;
}

function event(
  ts: string,
  kind: string,
  summary: string,
  source = "user",
  extra: Partial<Pick<JournalEvent, "supersedes" | "supersede_reason">> = {},
): JournalEvent {
  return {
    ts,
    kind,
    summary,
    provenance: {
      source,
      observed_at: ts,
      provider: null,
      authority: "observed",
    },
    classification: "private",
    supersedes: extra.supersedes ?? null,
    supersede_reason: extra.supersede_reason ?? null,
  };
}

const JOURNAL_EVENTS_POPULATED: JournalEvent[] = [
  event(
    "2026-09-19T16:00:00Z",
    "observation",
    "Correction noted: the database choice was wrong before — local storage is SQLite, not PostgreSQL.",
    "user",
    { supersedes: "2026-09-19T10:30:00Z", supersede_reason: "Database choice was recorded wrongly." },
  ),
  event(
    "2026-09-19T14:15:00Z",
    "observation",
    "Reviewed the vault encryption approach. Key derivation is deliberately not mirrored here — never put live material into fixtures.",
  ),
  event(
    "2026-09-19T10:30:00Z",
    "observation",
    "Started working on the new onboarding flow. The wireframes look solid — need to review accessibility before implementation.",
  ),
];

// ─── Chat fixtures (ChatHistory NDJSON line; ts = epoch seconds) ─────

interface ChatEntry {
  ts: number;
  role: string;
  content: string;
  provider?: string;
}

const CHAT_SEED: ChatEntry[] = [
  {
    ts: Date.parse("2026-09-19T10:00:00Z") / 1000,
    role: "user",
    content: "Hey Renai, how are the systems looking today?",
  },
  {
    ts: Date.parse("2026-09-19T10:00:05Z") / 1000,
    role: "assistant",
    content: "All systems are healthy! The vault is encrypted and locked, journal has 3 entries today, and the discovery feed is current. Nothing needs your attention right now.",
    provider: "ollama",
  },
];

// ─── Vault fixture state ─────────────────────────────────────────────

const SECRET_NAMES_SEED = ["API_KEY", "DATABASE_URL", "SECRET_TOKEN"];

// ─── Server sections (sections.resolve_sections shape) ───────────────

function section(
  id: string,
  label: string,
  icon: string,
  order: number,
  opts: { visible?: boolean; pinned?: boolean; kind?: string; configured?: boolean } = {},
) {
  return {
    id,
    label,
    icon,
    order,
    visible: opts.visible ?? true,
    pinned: opts.pinned ?? false,
    kind: opts.kind ?? "core",
    configured: opts.configured ?? true,
    status: null,
  };
}

const SERVER_SECTIONS = [
  section("today", "Today", "navigation--today", 0, { pinned: true }),
  section("interests", "Interests", "world-content--bookmark", 1),
  section("media", "Media", "world-content--story", 2),
  section("projects", "Projects", "navigation--projects", 3),
  section("lab", "Lab", "system-device--desktop", 4),
  section("journal", "Journal & Memory", "navigation--journal", 5),
  section("vault", "Vault", "system-device--lock", 6),
  section("chat", "Chat", "navigation--chat", 7, { kind: "transitional" }),
  section("settings", "Settings", "navigation--settings", 8, { pinned: true }),
];

// ─── Shared baseline handlers (health + session) ─────────────────────

function baselineHandlers(): RequestHandler[] {
  return [
    http.get("/healthz", () =>
      HttpResponse.json({
        ok: true,
        auth_configured: true,
        setup_needed: false,
        dev_bypass: false,
      }),
    ),
    http.get("/api/auth/session", () =>
      HttpResponse.json({
        ok: true,
        data: {
          principal_id: "person:rylee",
          auth_method: "instance-token",
          has_step_up: true,
        },
      }),
    ),
  ];
}

function envelopeHandlers(world: WorldState): RequestHandler[] {
  return [
    http.get("/api/status", () =>
      HttpResponse.json({
        ok: true,
        status: "healthy",
        data: {
          facts: 3,
          intents: 1,
          policies: 2,
          cemented_policies: 1,
          lore: { confirmed: 1, derived: 0, suggested: 0, ephemeral: 0 },
          declared_capabilities: Object.keys(world.capabilities).length,
          providers: 2,
          packs: 0,
          capabilities: world.capabilities,
          actors: [
            actor("native", "source_control", "healthy"),
            actor("ollama", "reasoning", "healthy"),
          ],
        },
      }),
    ),
    http.get("/api/daily", () =>
      HttpResponse.json({
        ok: true,
        status: "healthy",
        changed: false,
        warnings: [],
        actions: world.attention,
        data: {
          world: {
            facts: 3,
            intents: 1,
            policies: 2,
            cemented_policies: 1,
            lore: { confirmed: 1, derived: 0, suggested: 0, ephemeral: 0 },
            declared_capabilities: Object.keys(world.capabilities).length,
            providers: 2,
            packs: 0,
          },
          capabilities: world.capabilities,
          attention: world.attention,
        },
      }),
    ),
    http.get("/api/prefs", () =>
      HttpResponse.json({ ok: true, data: { ...PREFS_BASE, companion: world.companion } }),
    ),
  ];
}

// ─── Stateful per-screen builders ────────────────────────────────────

/**
 * Today-family world state. Fresh handlers per call so a story remount
 * resets server fiction to its documented starting point.
 */
function buildWorldHandlers(stateName: keyof typeof WORLD_STATES | string): RequestHandler[] {
  const world = WORLD_STATES[stateName] ?? WORLD_STATES.quiet;
  return [
    ...baselineHandlers(),
    ...envelopeHandlers(world),
    // The App shell consumes section order; the world sets keep the
    // default ordering so readouts match the story name.
    http.get("/api/sections", () =>
      HttpResponse.json({
        ok: true,
        data: { schema: "sections.v1", sections: [] },
      }),
    ),
  ];
}

function buildJournalHandlers(events: JournalEvent[]): RequestHandler[] {
  // Mutable copy so writes/supersedes behave live within a story mount.
  let current = [...events];
  return [
    ...baselineHandlers(),
    ...envelopeHandlers(WORLD_STATES.quiet),
    http.get("/api/journal", ({ request }) => {
      const url = new URL(request.url);
      const n = Number(url.searchParams.get("n") ?? 20);
      return HttpResponse.json({ ok: true, data: current.slice(0, n) });
    }),
    http.post("/api/journal", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { text?: string };
      const text = (body.text ?? "").trim();
      if (!text || text.length > 2000) {
        return HttpResponse.json(
          { detail: "text must be 1-2000 chars" },
          { status: 422 },
        );
      }
      const ts = new Date().toISOString();
      current = [event(ts, "observation", text), ...current];
      return HttpResponse.json({ ok: true, data: { written: text.length } });
    }),
    http.post("/api/journal/supersede", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as {
        supersedes?: string;
        text?: string;
        reason?: string;
      };
      const targetTs = body.supersedes ?? "";
      const corrected = (body.text ?? "").trim();
      if (!targetTs || !corrected) {
        return HttpResponse.json(
          { detail: "supersedes (entry timestamp) and text are required" },
          { status: 422 },
        );
      }
      const old = current.find((e) => e.ts === targetTs);
      if (!old) {
        return HttpResponse.json({
          ok: false,
          status: "not_configured",
          warnings: [`no journal entry found at ${targetTs}`],
        });
      }
      const ts = new Date().toISOString();
      const next = event(ts, "observation", corrected, "user", {
        supersedes: targetTs,
        supersede_reason: body.reason?.trim() || null,
      });
      // current_events semantics: the replaced entry leaves the
      // "current" list; the new head carries the chain link.
      current = [next, ...current.filter((e) => e.ts !== targetTs)].sort(
        (a, b) => (a.ts < b.ts ? 1 : -1),
      );
      return HttpResponse.json({
        ok: true,
        status: "healthy",
        data: {
          current: next,
          superseded: old,
          audit: event(ts, "approval", `entry superseded: ${old.summary.slice(0, 60)}`, "user"),
          already_applied: false,
        },
      });
    }),
    http.get("/api/journal/history", ({ request }) => {
      const url = new URL(request.url);
      const ts = url.searchParams.get("ts") ?? "";
      // Walk the chain: head + everything that links (transitively) to it.
      const head = current.find((e) => e.ts === ts);
      if (!head) {
        return HttpResponse.json({
          ok: false,
          status: "not_configured",
          warnings: [`no journal entry found at ${ts}`],
        });
      }
      const chain: JournalEvent[] = [head];
      let cursor = head;
      while (cursor.supersedes) {
        const prev = current.find((e) => e.ts === cursor.supersedes) ??
          ORIGINALS.find((e) => e.ts === cursor.supersedes);
        if (!prev) break;
        chain.unshift(prev);
        cursor = prev;
      }
      return HttpResponse.json({
        ok: true,
        status: "healthy",
        data: { entries: chain },
      });
    }),
  ];
}

/** Superseded originals stay in the mock's "append-only" store — the
 * current list never shows them, but a chain lookup does. */
const ORIGINALS: JournalEvent[] = [
  event(
    "2026-09-19T10:30:00Z",
    "observation",
    "Started working on the new onboarding flow. The wireframes look solid — need to review accessibility before implementation.",
  ),
];

/**
 * Vault state machine mock — honours the real contract:
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
    ...envelopeHandlers(
      locked ? { ...WORLD_STATES.quiet, capabilities: CAPS_OFFLINE } : WORLD_STATES.quiet,
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
      return HttpResponse.json({
        ok: true,
        status: "unlocked",
        data: null,
        warnings: [],
      });
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
        return HttpResponse.json(
          { detail: "name and value required" },
          { status: 400 },
        );
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
  let sections = [...SERVER_SECTIONS];
  const resolve = (order: string[] | undefined, hidden: string[]) => {
    const byId = new Map(sections.map((s) => [s.id, s]));
    const finalIds = [
      ...(order ?? sections.map((s) => s.id)).filter((id) => byId.has(id)),
      ...sections.map((s) => s.id).filter((id) => !order?.includes(id)),
    ];
    return finalIds.map((id, position) => {
      const s = byId.get(id)!;
      return {
        ...s,
        order: position,
        visible: s.pinned ? true : !hidden.includes(id),
      };
    });
  };
  return [
    ...baselineHandlers(),
    ...envelopeHandlers({ ...WORLD_STATES.quiet, companion: "mermaid" }),
    http.get("/api/status", () =>
      HttpResponse.json({
        ok: true,
        status: "healthy",
        data: {
          facts: 3,
          intents: 1,
          policies: 2,
          cemented_policies: 1,
          lore: { confirmed: 1, derived: 0, suggested: 0, ephemeral: 0 },
          declared_capabilities: 4,
          providers: 2,
          packs: 0,
          capabilities: {
            source_control: cap("healthy"),
            discovery: cap("healthy"),
            journal: cap("healthy"),
            secrets: cap("stale", ["Last backup 7 days ago"]),
          },
          actors: [actor("native", "source_control", "healthy")],
        },
      }),
    ),
    http.get("/api/brain/templates", () =>
      HttpResponse.json({
        ok: true,
        data: {
          templates: [
            {
              id: "daily-digest",
              version: "1",
              kind: "task",
              surface: "daily",
              max_tokens: 900,
              source: "shipped",
              description: "Compose the daily digest.",
              content_length: 180,
              has_override: false,
            },
            {
              id: "journal-prompt",
              version: "1",
              kind: "task",
              surface: "journal",
              max_tokens: 600,
              source: "shipped",
              description: "Prompt a journal reflection.",
              content_length: 140,
              has_override: false,
            },
          ],
        },
      }),
    ),
    http.get("/api/manifest", () =>
      HttpResponse.json({
        ok: true,
        data: {
          journal: {
            capability: "journal",
            native_baseline: true,
            active_provider: "native",
            providers: [],
          },
        },
        endpoints: [
          {
            id: "API-005-journal-list",
            method: "GET",
            path: "/api/journal",
            capability: "journal",
            kind: "read",
            gate: "none",
            auth: "authenticated",
            note: null,
          },
        ],
      }),
    ),
    http.get("/api/prefs", () => HttpResponse.json({ ok: true, data: PREFS_BASE })),
    http.put("/api/prefs", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      return HttpResponse.json({ ok: true, data: { ...PREFS_BASE, ...body } });
    }),
    http.get("/api/sections", () =>
      HttpResponse.json({ ok: true, data: { schema: "sections.v1", sections } }),
    ),
    http.put("/api/sections", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as {
        order?: string[];
        hidden?: string[];
      };
      sections = resolve(body.order, body.hidden ?? []);
      return HttpResponse.json({
        ok: true,
        data: { schema: "sections.v1", sections },
      });
    }),
    http.get("/api/identity/principal", () =>
      HttpResponse.json({
        ok: true,
        data: {
          id: "person:rylee",
          kind: "person",
          display_name: "Rylee",
          scopes: ["admin"],
          source: "instance-token",
        },
      }),
    ),
    http.put("/api/identity/principal", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { display_name?: string };
      return HttpResponse.json({
        ok: true,
        data: {
          id: "person:rylee",
          kind: "person",
          display_name: body.display_name ?? "Rylee",
          scopes: ["admin"],
          source: "instance-token",
        },
      });
    }),
  ];
}

function buildChatHandlers(seed: ChatEntry[]): RequestHandler[] {
  let messages = [...seed];
  return [
    ...baselineHandlers(),
    ...envelopeHandlers(WORLD_STATES.quiet),
    http.get("/api/chat/history", ({ request }) => {
      const url = new URL(request.url);
      const n = Number(url.searchParams.get("n") ?? 50);
      const entries = messages.slice(-n);
      return HttpResponse.json({ ok: true, data: { entries, count: entries.length } });
    }),
    http.get("/api/chat/providers", () =>
      HttpResponse.json({
        ok: true,
        data: {
          providers: [
            {
              name: "ollama",
              display_name: "Ollama (local)",
              status: "healthy",
              ok: true,
            },
          ],
          active: "ollama",
        },
      }),
    ),
    http.post("/api/chat", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { message?: string };
      if (!body.message) {
        return HttpResponse.json(
          { detail: "message is required" },
          { status: 400 },
        );
      }
      const now = Date.now() / 1000;
      messages = [
        ...messages,
        { ts: now, role: "user", content: body.message },
        {
          ts: now + 0.2,
          role: "assistant",
          content: "Noted — this is a mock reply served by MSW, not a live model.",
          provider: "ollama",
        },
      ];
      return HttpResponse.json({
        ok: true,
        status: "healthy",
        changed: false,
        warnings: [],
        actions: [],
        data: { reply: messages[messages.length - 1].content, provider: "ollama" },
      });
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

// ─── Named handler sets ──────────────────────────────────────────────

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
  journalPopulated: () => buildJournalHandlers(JOURNAL_EVENTS_POPULATED),

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
