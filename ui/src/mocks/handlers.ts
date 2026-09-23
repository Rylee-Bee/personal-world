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
 *                                density, target_size, companion, accent,
 *                                tone, personality_pack}}
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
  tone: "warm",
  personality_pack: "off",
};

// The Settings Room (Track C) renders from GET /api/prefs/schema, so
// the mock mirrors src/personal_world/prefs.py PREFS exactly — same
// keys, same closed vocabularies, same floors. The PUT handler below
// validates against this table the way prefs.set_prefs does.

type PrefKey =
  | "motion"
  | "contrast"
  | "text_scale"
  | "density"
  | "target_size"
  | "companion"
  | "accent"
  | "tone"
  | "personality_pack";

interface PrefSpec {
  type: "enum" | "number";
  default: string | number;
  floor: string | number;
  allowed: Array<string | number>;
  integer?: boolean;
  unit?: string;
}

const PREFS_SCHEMA: Record<PrefKey, PrefSpec> = {
  motion: {
    type: "enum", default: "reduced", floor: "off",
    allowed: ["off", "reduced", "subtle"],
  },
  contrast: {
    type: "enum", default: "comfortable", floor: "comfortable",
    allowed: ["comfortable", "high"],
  },
  text_scale: {
    type: "number", default: 1.0, floor: 1.0,
    allowed: [1.0, 1.25, 1.5], integer: false, unit: "",
  },
  density: {
    type: "enum", default: "comfortable", floor: "compact",
    allowed: ["comfortable", "compact"],
  },
  target_size: {
    type: "number", default: 44, floor: 44,
    allowed: [44, 56], integer: true, unit: "px",
  },
  companion: {
    type: "enum", default: "personal-world", floor: "personal-world",
    allowed: [
      "personal-world", "mermaid", "robot",
      "world-tree-squirrel", "taco-news-truck",
    ],
  },
  accent: {
    type: "enum", default: "world-keeper", floor: "world-keeper",
    allowed: ["world-keeper", "rylee"],
  },
  // Voice prefs (TRUE-NORTH § Voice, W1-B) — mirrors prefs.py TONE /
  // PERSONALITY_PACK exactly.
  tone: {
    type: "enum", default: "warm", floor: "warm",
    allowed: ["warm", "concise", "playful", "formal"],
  },
  personality_pack: {
    type: "enum", default: "off", floor: "off",
    allowed: ["off", "residents"],
  },
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

// ─── Projects fixtures (agent-sync normalized rows) ─────────────────
// Mirrors providers/agent_sync.py _normalize exactly: closed
// vocabularies, null = honest unknown, remote_url is the row's
// authoritative source link. Fiction only (example.invalid).

const PROJECT_ROWS = [
  {
    project: "personal-world",
    path: "/srv/projects/personal-world",
    is_git_repo: true,
    branch: "main",
    local_head: "2527c0d",
    remote_name: "origin",
    remote_url: "https://example.invalid/personal-world.git",
    remote_head: "2527c0d",
    publish_state: "match",
    working_tree: { staged: 0, modified: 2, untracked: 0, conflicted: 0 },
    play_nice: { present: true, revision: "1", source_repository: null },
    work_state: "working",
    safe_to_leave: "no",
    error: null,
  },
  {
    project: "pickle",
    path: "/srv/projects/pickle",
    is_git_repo: true,
    branch: "dev",
    local_head: "abc1234",
    remote_name: null,
    remote_url: null,
    remote_head: null,
    publish_state: null,
    working_tree: { staged: 0, modified: 0, untracked: 1, conflicted: 0 },
    play_nice: { present: false, revision: null, source_repository: null },
    work_state: "waiting_for_help",
    safe_to_leave: "unknown",
    error: null,
  },
];

/** The Overview home-loop's project feed per world state: degraded
 *  worlds answer the honest ok:false unavailable envelope (the
 *  agent-sync-absent contract), the rest a dated two-row observation. */
function projectsStatusBody(stateName: string) {
  if (
    stateName === "unavailable" ||
    stateName === "offline" ||
    stateName === "empty"
  ) {
    return {
      ok: false,
      status: "unavailable",
      data: null,
      warnings: [
        "agent-sync observation unavailable (command absent, timed out, or malformed)",
      ],
    };
  }
  return {
    ok: true,
    status: "healthy",
    data: {
      observed_at: "2026-09-22T08:00:00Z",
      freshness: "fresh",
      age_seconds: 120,
      projects: PROJECT_ROWS,
    },
    warnings: [],
  };
}

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
    // GET /api/prefs/schema — static server vocabulary (api.py
    // prefs_schema, built from prefs.py PREFS). The App chrome applies
    // prefs document-wide from C12, so every world state — not just
    // the Settings builder — must answer this or the shell bypasses
    // to a real network.
    http.get("/api/prefs/schema", () =>
      HttpResponse.json({ ok: true, data: PREFS_SCHEMA }),
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
    // Overview's Pinned feed reads the Records capability too.
    ...buildRecordsHandlers(),
    // The App shell consumes section order; the world sets keep the
    // default ordering so readouts match the story name.
    http.get("/api/sections", () =>
      HttpResponse.json({
        ok: true,
        data: { schema: "sections.v1", sections: [] },
      }),
    ),
    // Home-loop queries (TRUE-NORTH W1-A): the thread reads the
    // journal, the sliver reads discovery status, the parked-Projects
    // rows read the agent-sync observation. An empty world has an
    // empty journal; degraded worlds lose the sensor honestly.
    http.get("/api/journal", ({ request }) => {
      const url = new URL(request.url);
      const n = Number(url.searchParams.get("n") ?? 20);
      const events =
        stateName === "empty" ? [] : JOURNAL_EVENTS_POPULATED;
      return HttpResponse.json({ ok: true, data: events.slice(0, n) });
    }),
    http.get("/api/discovery/status", () =>
      HttpResponse.json({
        ok: true,
        status: "healthy",
        data: {
          sources: [],
          interests: [],
          items: [],
          source_count: 0,
          interest_count: 0,
          item_count: 0,
        },
        warnings: [],
      }),
    ),
    http.get("/api/projects/status", () =>
      HttpResponse.json(projectsStatusBody(stateName)),
    ),
  ];
}

function buildJournalHandlers(events: JournalEvent[]): RequestHandler[] {
  // Mutable copy so writes/supersedes behave live within a story mount.
  let current = [...events];
  // The journal draft is part of the journal world (api.py journal_draft_*):
  // without these routes the Memory story's draft-sync GET bypasses MSW,
  // hits the live auth-gated backend through the proxy, and its 401 used to
  // navigate the story iframe away (2026-09-22 flake, found by vitest).
  let draft: { text: string; updated_at: string } | null = null;
  return [
    http.get("/api/journal/draft", () =>
      HttpResponse.json({
        ok: true,
        data: draft
          ? { ...draft, length: draft.text.length }
          : { text: null, updated_at: null },
      }),
    ),
    http.put("/api/journal/draft", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { text?: string };
      draft = { text: String(body.text ?? ""), updated_at: new Date().toISOString() };
      return HttpResponse.json({ ok: true, data: { ...draft, length: draft.text.length } });
    }),
    http.delete("/api/journal/draft", () => {
      draft = null;
      return HttpResponse.json({ ok: true, data: { removed: true } });
    }),
    ...baselineHandlers(),
    ...envelopeHandlers(WORLD_STATES.quiet),
    // Memory hosts Records: the panel browses /api/records* while
    // stories are mounted (stateful per mount, like the journal).
    ...buildRecordsHandlers(),
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
    // GET /api/memory/search — the native provider indexes journal
    // entries (providers/native_memory.py), so this fixture searches
    // the same in-memory current list. Memory's Records panel reads
    // ONLY this; no invented rows anywhere.
    http.get("/api/memory/search", ({ request }) => {
      const url = new URL(request.url);
      const q = url.searchParams.get("q") ?? "";
      const topK = Math.min(Math.max(Number(url.searchParams.get("top_k") ?? 5), 1), 50);
      const needle = q.toLowerCase();
      const results = current
        .filter((e) => e.summary.toLowerCase().includes(needle))
        .slice(0, topK)
        .map((e) => ({
          id: `journal:${e.ts}`,
          kind: e.kind,
          text: e.summary,
          timestamp: e.ts,
        }));
      return HttpResponse.json({
        ok: true,
        status: "healthy",
        data: { results, query: q, count: results.length },
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
  // Session-persistent prefs, like the server's world store: PUT writes
  // here, GET reads back what was actually saved.
  const prefsLive: Record<PrefKey, string | number> = { ...PREFS_BASE };
  // The Vault tool is embedded in Settings now (contract: secrets are
  // infrastructure, under Advanced) — so the Settings world must serve
  // /api/vault/* too, in its documented locked start state. Without
  // this the unhandled request bypasses MSW and the story falls
  // through to whatever real station answers the proxy (401 → a hard
  // /login redirect that kills the story iframe).
  let vaultLocked = true;
  let secretNames: string[] = [...SECRET_NAMES_SEED];
  const vaultLockedResponse = () =>
    HttpResponse.json({ detail: "vault is locked" }, { status: 409 });
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
    http.get("/api/prefs", () => HttpResponse.json({ ok: true, data: { ...prefsLive } })),
    // GET /api/prefs/schema — mirrors api.py prefs_schema(): enum rows
    // carry {type, default, floor, allowed}; number rows additionally
    // carry {integer, unit}. Values are the real prefs.py vocabulary.
    http.get("/api/prefs/schema", () =>
      HttpResponse.json({ ok: true, data: PREFS_SCHEMA }),
    ),
    // PUT /api/prefs — same discipline as prefs.set_prefs: unknown keys
    // or out-of-vocabulary values answer 400 + detail with every
    // reason; nothing applies unless the whole body validates. On
    // success the merged prefs persist for this mock session, like the
    // server's world store — a story remount resets to defaults.
    http.put("/api/prefs", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const next: Record<PrefKey, string | number> = { ...prefsLive };
      const errors: string[] = [];
      for (const [key, value] of Object.entries(body)) {
        const spec = PREFS_SCHEMA[key as PrefKey];
        if (!spec) {
          errors.push(`unknown preference '${key}'`);
          continue;
        }
        if (!spec.allowed.includes(value as string & number)) {
          errors.push(`${key}: ${JSON.stringify(value)} is not an allowed value`);
          continue;
        }
        next[key as PrefKey] = value as string | number;
      }
      if (errors.length > 0) {
        return HttpResponse.json({ detail: errors.join("; ") }, { status: 400 });
      }
      for (const key of Object.keys(next) as PrefKey[]) {
        prefsLive[key] = next[key];
      }
      return HttpResponse.json({ ok: true, data: { ...prefsLive } });
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
    // Vault tool handlers (Settings → Advanced) — same locked-start
    // fiction and refusal shapes as buildVaultHandlers.
    http.get("/api/vault/status", () =>
      HttpResponse.json({ ok: true, data: { locked: vaultLocked, encrypted: true } }),
    ),
    http.get("/api/vault/names", () => {
      if (vaultLocked) return vaultLockedResponse();
      return HttpResponse.json({ ok: true, data: { names: secretNames } });
    }),
    http.post("/api/vault/unlock", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { passphrase?: string };
      if (!body.passphrase) {
        return HttpResponse.json({ detail: "passphrase required" }, { status: 400 });
      }
      vaultLocked = false;
      return HttpResponse.json({ ok: true, status: "unlocked", data: null, warnings: [] });
    }),
    http.post("/api/vault/lock", () => {
      vaultLocked = true;
      return HttpResponse.json({ ok: true, data: { locked: true } });
    }),
    http.post("/api/vault/set", async ({ request }) => {
      if (vaultLocked) return vaultLockedResponse();
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
      if (!secretNames.includes(body.name)) secretNames = [...secretNames, body.name];
      return HttpResponse.json({ ok: true, data: { name: body.name } });
    }),
    http.delete("/api/vault/:name", ({ params }) => {
      if (vaultLocked) return vaultLockedResponse();
      const name = String(params.name ?? "");
      secretNames = secretNames.filter((n) => n !== name);
      return HttpResponse.json({ ok: true, data: { name } });
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

// ─── Discovery / Interests fixtures (Track C) ────────────────────────
// Shapes mirror providers/native_discovery.py exactly:
//   observe()  → {sources, interests, items(=in-memory, always empty
//                on a fresh engine), source_count, interest_count,
//                item_count}
//   discover() → {items, count, sources_queried}; engine-backed items
//   carry provenance {engine, source_type} (see _discover_engine).

interface FixtureSource {
  id: string;
  name: string;
  source_type: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

function discoverySource(
  id: string,
  name: string,
  source_type: string,
  enabled: boolean,
  config: Record<string, unknown> = {},
): FixtureSource {
  return { id, name, source_type, config, enabled };
}

function discoveryInterest(id: string, name: string, category: string | null) {
  return {
    id,
    name,
    category,
    weight: 1.0,
    created_at: "2026-09-18T12:00:00+00:00",
  };
}

/** Engine find — provenance exactly as _discover_engine writes it. */
function engineFind(
  id: string,
  title: string,
  sourceName: string,
  sourceType: string,
  url: string | null,
) {
  return {
    id,
    title,
    source: sourceName,
    content_type: "update",
    url,
    description: null,
    tags: [],
    discovered_at: "2026-09-20T08:55:00+00:00",
    provenance: {
      engine: "candy-dispenser discovery (vendored)",
      source_type: sourceType,
    },
  };
}

type DiscoveryVariant = "populated" | "noSources" | "captureOff" | "nothingMatched";

function buildDiscoveryHandlers(variant: DiscoveryVariant): RequestHandler[] {
  const sources: FixtureSource[] =
    variant === "populated"
      ? [
          discoverySource("pw-releases", "Project Worlds releases", "github_releases", true),
          discoverySource("lab-feed", "Lab news feed", "rss", false, {
            url: "https://example.invalid/feed.xml",
            tags: [],
          }),
        ]
      : variant === "captureOff"
        ? [
            discoverySource("pw-releases", "Project Worlds releases", "github_releases", false),
            discoverySource("music-feed", "Music blog feed", "rss", false, {
              url: "https://example.invalid/music.xml",
              tags: [],
            }),
          ]
        : variant === "nothingMatched"
          ? [discoverySource("pw-releases", "Project Worlds releases", "github_releases", true)]
          : [];

  const interests =
    variant === "populated" || variant === "nothingMatched"
      ? [discoveryInterest("self-hosting", "self-hosting", "software")]
      : [];

  const finds = variant === "populated" ? [
    engineFind(
      "pw-releases:v1.4.0",
      "Project Worlds v1.4.0 published",
      "Project Worlds releases",
      "github_releases",
      "https://example.invalid/releases/pw-v1.4.0",
    ),
    engineFind(
      "pw-releases:v1.3.2",
      "Project Worlds v1.3.2 published",
      "Project Worlds releases",
      "github_releases",
      "https://example.invalid/releases/pw-v1.3.2",
    ),
  ] : [];

  return [
    ...baselineHandlers(),
    ...envelopeHandlers(WORLD_STATES.quiet),
    http.get("/api/discovery/status", () =>
      HttpResponse.json({
        ok: true,
        status: "healthy",
        data: {
          sources,
          interests,
          items: [],
          source_count: sources.length,
          interest_count: interests.length,
          item_count: 0,
        },
        warnings: [],
      }),
    ),
    http.get("/api/discovery/discover", () =>
      HttpResponse.json({
        ok: true,
        status: "healthy",
        data: {
          items: finds,
          count: finds.length,
          sources_queried: sources.filter((s) => s.enabled).length,
        },
        warnings: [],
      }),
    ),
  ];
}

// ─── Records fixtures (Memory → Records + Overview Pinned) ─────────
// Mirrors src/personal_world/records.py + docs/RECORDS-API.md exactly:
// category rows {slug,name,locked,count,pinned-count}, record values
// {id,category,category_name,title,fields,pinned,created,updated},
// the 409 {status:"locked"} read refusal until step-up is granted,
// and ok:false not_found envelopes for missing targets. Fiction only —
// "Passport number Z999" is fixture material, never a real document.

function buildRecordsHandlers(): RequestHandler[] {
  type Cat = { slug: string; name: string; locked: boolean };
  type Rec = {
    id: string;
    category: string;
    category_name: string;
    title: string;
    fields: Record<string, string | number | boolean | null>;
    pinned: boolean;
    created: string;
    updated: string;
  };
  const cats: Cat[] = [
    { slug: "medical", name: "Medical", locked: false },
    { slug: "identity-documents", name: "Identity documents", locked: true },
  ];
  const recs: Rec[] = [
    {
      id: "allergy-list-f1e2d3",
      category: "medical",
      category_name: "Medical",
      title: "Allergy list",
      fields: { severe: "Penicillin", noted: "2026-03-14" },
      pinned: true,
      created: "2026-09-18T10:00:00+00:00",
      updated: "2026-09-18T10:00:00+00:00",
    },
    {
      id: "clinic-address-a4b5c6",
      category: "medical",
      category_name: "Medical",
      title: "Clinic address",
      fields: { line: "42 Harbour Rd" },
      pinned: false,
      created: "2026-09-19T08:00:00+00:00",
      updated: "2026-09-19T08:00:00+00:00",
    },
    {
      id: "passport-number-d7e8f9",
      category: "identity-documents",
      category_name: "Identity documents",
      title: "Passport number",
      fields: { number: "Z999-FIXTURE" },
      pinned: false,
      created: "2026-09-17T12:00:00+00:00",
      updated: "2026-09-17T12:00:00+00:00",
    },
  ];
  // The elevation seam: POST /api/auth/step-up grants it; the locked
  // read consumes it. Seeded granted so default stories browse every
  // category (like a loopback session on the real station); a story
  // or test can exercise the invitation via a route override.
  let granted = true;

  const slugOf = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const categoryRows = () =>
    cats
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        locked: c.locked,
        count: recs.filter((r) => r.category === c.slug).length,
        pinned: recs.filter((r) => r.category === c.slug && r.pinned).length,
      }))
      .sort((a, b) => (a.slug < b.slug ? -1 : 1));

  const isLocked = (slug: string) =>
    cats.find((c) => c.slug === slug)?.locked ?? false;

  return [
    http.get("/api/records/categories", () =>
      HttpResponse.json({
        ok: true,
        status: "healthy",
        data: { categories: categoryRows() },
      }),
    ),
    http.get("/api/records", ({ request }) => {
      const url = new URL(request.url);
      const category = url.searchParams.get("category");
      const pinned = url.searchParams.get("pinned") === "true";
      if (category !== null) {
        const slug = slugOf(category);
        if (isLocked(slug) && !granted) {
          return HttpResponse.json(
            {
              ok: false,
              status: "locked",
              category: slug,
              warnings: [
                `category '${slug}' is locked: step-up required to read`,
              ],
            },
            { status: 409 },
          );
        }
        const list = recs
          .filter((r) => r.category === slug && (!pinned || r.pinned))
          .sort((a, b) => (a.created < b.created ? -1 : 1));
        return HttpResponse.json({
          ok: true,
          status: "healthy",
          data: {
            category: slug,
            locked: isLocked(slug),
            records: list,
          },
        });
      }
      if (pinned) {
        // Locked categories are never aggregated into the feed.
        const list = recs
          .filter((r) => r.pinned && !isLocked(r.category))
          .sort((a, b) => (a.updated > b.updated ? -1 : 1));
        return HttpResponse.json({
          ok: true,
          status: "healthy",
          data: { records: list },
        });
      }
      const list = recs
        .filter((r) => !isLocked(r.category))
        .sort((a, b) => (a.created > b.created ? -1 : 1));
      return HttpResponse.json({ ok: true, status: "healthy", data: { records: list } });
    }),
    http.post("/api/auth/step-up", async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { token?: unknown };
      if (typeof body.token !== "string" || body.token.trim() === "") {
        return HttpResponse.json(
          { detail: "step-up credential invalid" },
          { status: 403 },
        );
      }
      granted = true;
      return HttpResponse.json({
        ok: true,
        data: { has_step_up: true, expires_in: 300, principal_id: "person:rylee" },
      });
    }),
    http.post("/api/records", async ({ request }) => {
      const body = (await request.json().catch(() => null)) as {
        id?: string;
        category?: string;
        title?: string;
        fields?: Record<string, string | number | boolean | null>;
        locked?: boolean;
      } | null;
      if (body === null || typeof body !== "object") {
        // The server's exact refusal for a non-object body (api.py).
        return HttpResponse.json(
          { detail: "body must be an object" },
          { status: 400 },
        );
      }
      const title = (body.title ?? "").trim();
      const category = (body.category ?? "").trim();
      if (title === "") {
        return HttpResponse.json({ detail: "title is required" }, { status: 422 });
      }
      if (category === "") {
        return HttpResponse.json({ detail: "category is required" }, { status: 422 });
      }
      const slug = slugOf(category);
      let cat = cats.find((c) => c.slug === slug);
      if (!cat) {
        cat = { slug, name: category.slice(0, 80), locked: false };
        cats.push(cat);
      }
      if (typeof body.locked === "boolean") cat.locked = body.locked;
      const iso = new Date().toISOString();
      const existing = body.id ? recs.find((r) => r.id === body.id) : undefined;
      if (existing) {
        existing.title = title;
        existing.fields = body.fields ?? existing.fields;
        existing.category = slug;
        existing.category_name = cat.name;
        existing.updated = iso;
        return HttpResponse.json({ ok: true, status: "healthy", data: { ...existing } });
      }
      const rec: Rec = {
        id: `${slugOf(title).slice(0, 40) || "record"}-${recs.length}${Date.now() % 1000}`,
        category: slug,
        category_name: cat.name,
        title,
        fields: body.fields ?? {},
        pinned: false,
        created: iso,
        updated: iso,
      };
      recs.push(rec);
      return HttpResponse.json({ ok: true, status: "healthy", data: { ...rec } });
    }),
    http.post("/api/records/pin", async ({ request }) =>
      setFixturePin(await readTarget(request), true),
    ),
    http.post("/api/records/unpin", async ({ request }) =>
      setFixturePin(await readTarget(request), false),
    ),
    http.delete("/api/records", async ({ request }) => {
      const target = await readTarget(request);
      const slug = slugOf(target.category ?? "");
      const i = recs.findIndex((r) => r.category === slug && r.id === target.id);
      if (i === -1) {
        return HttpResponse.json({
          ok: false,
          status: "not_found",
          warnings: ["no such record"],
        });
      }
      recs.splice(i, 1);
      return HttpResponse.json({ ok: true, status: "healthy", data: { deleted: true } });
    }),
  ];

  async function readTarget(request: Request): Promise<{ category?: string; id?: string }> {
    const body = (await request.json().catch(() => ({}))) as unknown;
    return body && typeof body === "object"
      ? (body as { category?: string; id?: string })
      : {};
  }

  function setFixturePin(
    target: { category?: string; id?: string },
    pinned: boolean,
  ) {
    const slug = slugOf(target.category ?? "");
    const rec = recs.find((r) => r.category === slug && r.id === target.id);
    if (!rec) {
      return HttpResponse.json({
        ok: false,
        status: "not_found",
        warnings: ["no such record"],
      });
    }
    rec.pinned = pinned;
    rec.updated = new Date().toISOString();
    return HttpResponse.json({ ok: true, status: "healthy", data: { ...rec } });
  }
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

  // Interests screen states (Track C) — engine finds, honest empties
  interestsPopulated: () => buildDiscoveryHandlers("populated"),
  interestsNoSources: () => buildDiscoveryHandlers("noSources"),
  interestsCaptureOff: () => buildDiscoveryHandlers("captureOff"),
  interestsNothingMatched: () => buildDiscoveryHandlers("nothingMatched"),

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
