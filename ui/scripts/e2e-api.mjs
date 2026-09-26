#!/usr/bin/env node
/**
 * e2e-api.mjs — deterministic Station API for Playwright e2e runs.
 *
 * Why this exists: the preview bundle contains no MSW (mocks are
 * Storybook-only) and the live backend on :8000 is auth-gated (every
 * data endpoint answers 401 without an instance token, which e2e
 * must never carry). So `playwright test` boots THIS server instead —
 * it speaks the REAL wire contract (src/personal_world/api.py,
 * verified 2026-09-20): `{ok, status, data, warnings}` envelopes,
 * JournalEvent = {ts, kind, summary, provenance, classification,
 * supersedes, supersede_reason}, prefs = server accessibility
 * vocabulary. If the contract changes, change this file — the specs
 * assert product behaviour through it.
 *
 * The data is FICTION, clearly separated from the appliance: fixed
 * fixtures, in-memory only, no personal data, nothing persisted.
 *
 * Started by playwright.config.ts (webServer) on 127.0.0.1:4174; the
 * preview proxy points at it via VITE_API_PROXY_TARGET.
 *
 * One world per Playwright worker. The process on :4174 is a small
 * router: every request carries `x-e2e-worker` (set by e2e/test.ts), and
 * the router starts a private copy of this server for each worker on
 * first use, then pipes that worker's requests to it. So a spec's
 * `DELETE /api/__test/reset` or a draft/crew write can never land in the
 * middle of another worker's test. Requests without the header share
 * one "default" world (the webServer health check, ad-hoc curl).
 */

import http from "node:http";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.E2E_API_PORT ?? 4174);
const NOW_ISO = "2026-09-20T09:00:00Z";

const ok = (status, data) => ({ ok: true, status, data });

const WORLD_SUMMARY = {
  facts: 3,
  intents: 1,
  policies: 2,
  cemented_policies: 1,
  lore: { confirmed: 1, derived: 0, suggested: 0, ephemeral: 0 },
  declared_capabilities: 4,
  providers: 2,
  packs: 0,
};

const CAPABILITIES = {
  source_control: { ok: true, status: "healthy", warnings: [], last_observed: NOW_ISO },
  discovery: { ok: true, status: "healthy", warnings: [], last_observed: NOW_ISO },
  journal: { ok: true, status: "healthy", warnings: [], last_observed: NOW_ISO },
  secrets: { ok: true, status: "healthy", warnings: [], last_observed: NOW_ISO },
};

function journalEvent(ts, summary, extra = {}) {
  return {
    ts,
    kind: "observation",
    summary,
    provenance: {
      source: "user",
      observed_at: ts,
      provider: null,
      authority: "observed",
    },
    classification: "private",
    supersedes: extra.supersedes ?? null,
    supersede_reason: extra.supersede_reason ?? null,
  };
}

// In-memory journal (current versions; superseded originals stay
// reachable through the chain endpoint, like the append-only server).
let DRAFT = null; // the lining rescue: /api/journal/draft (api.py journal_draft_*)

const CURRENT = [
  journalEvent("2026-09-19T16:00:00Z", "Correction noted: the database choice was wrong before — local storage is SQLite.", {
    supersedes: "2026-09-19T10:30:00Z",
    supersede_reason: "Database choice was recorded wrongly.",
  }),
  journalEvent("2026-09-19T14:15:00Z", "Reviewed the vault encryption approach — fixtures never carry live material."),
  journalEvent("2026-09-19T10:30:00Z", "Started working on the new onboarding flow."),
];
const SUPERSEDED = [
  journalEvent("2026-09-19T10:30:00Z", "Started working on the new onboarding flow. The wireframes look solid."),
];

// Test-only seed snapshots: DELETE /api/__test/reset restores the fixture
// world (journal + superseded + draft) so specs never leak state into each
// other on the shared server — CI proved the order dependence the hard way
// (the draft suite's published entry became Overview's "newest thread").
// Not a product API: this server only ever runs under Playwright.
const CURRENT_SEED = structuredClone(CURRENT);
const SUPERSEDED_SEED = structuredClone(SUPERSEDED);

// In-memory chat transcript (ts = epoch SECONDS, like ChatHistory NDJSON).
let TRANSCRIPT = [
  { ts: Date.parse("2026-09-19T10:00:00Z") / 1000, role: "user", content: "How are the systems looking?" },
  { ts: Date.parse("2026-09-19T10:00:05Z") / 1000, role: "assistant", content: "All systems are healthy. Nothing needs your attention right now.", provider: "ollama" },
];

const PREFS = {
  motion: "reduced",
  contrast: "comfortable",
  text_scale: 1,
  density: "comfortable",
  target_size: 44,
  companion: "mermaid",
  accent: "world-keeper",
  tone: "warm",
  personality_pack: "residents",
};

// GET /api/prefs/schema — mirrors api.py prefs_schema() built from
// prefs.py PREFS (keys, vocabularies, floors). The Settings Room
// renders ONLY from this table, so the mock must be exact.
const PREFS_SCHEMA = {
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
    type: "enum", default: "assistant", floor: "assistant",
    allowed: [
      "assistant", "personal-world", "mermaid", "robot",
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
    type: "enum", default: "residents", floor: "off",
    allowed: ["off", "residents"],
  },
};

// ── Discovery fixtures (Track C · Interests view) ────────────────────
// Shapes mirror providers/native_discovery.py: observe() data =
// {sources, interests, items, *_count}; discover() data =
// {items, count, sources_queried} with engine provenance
// {engine, source_type} exactly as _discover_engine writes it.

const DISCOVERY_SOURCES = [
  {
    id: "pw-releases",
    name: "Project Worlds releases",
    source_type: "github_releases",
    config: {},
    enabled: true,
  },
  {
    id: "lab-feed",
    name: "Lab news feed",
    source_type: "rss",
    config: { url: "https://example.invalid/feed.xml", tags: [] },
    enabled: false,
  },
];

const DISCOVERY_INTERESTS = [
  {
    id: "self-hosting",
    name: "self-hosting",
    category: "software",
    weight: 1.0,
    created_at: "2026-09-18T12:00:00+00:00",
  },
];

const DISCOVERY_FINDS = [
  {
    id: "pw-releases:v1.4.0",
    title: "Project Worlds v1.4.0 published",
    source: "Project Worlds releases",
    content_type: "update",
    url: "https://example.invalid/releases/pw-v1.4.0",
    description: null,
    tags: [],
    discovered_at: "2026-09-20T08:55:00+00:00",
    provenance: {
      engine: "candy-dispenser discovery (vendored)",
      source_type: "github_releases",
    },
  },
];

const SECTIONS = [
  { id: "today", label: "Today", icon: "navigation--today", order: 0, visible: true, pinned: true, kind: "core", configured: true, status: null },
  { id: "journal", label: "Journal & Memory", icon: "navigation--journal", order: 1, visible: true, pinned: false, kind: "core", configured: true, status: null },
  { id: "settings", label: "Settings", icon: "navigation--settings", order: 2, visible: true, pinned: true, kind: "core", configured: true, status: null },
];

// ── Worlds briefing + place fixtures (Bridge home, contract v1) ──────
// FICTION ONLY. Covers arrivals, a five-item have_tos total (the tray
// cap), one not_configured system (news), one unavailable system
// (threads), and a person-authored thread. Shapes copy the published
// worlds-briefing/1 contract; see ui/src/data/contract.ts.

function bridgeResident(key, name, portrait) {
  return { key, name, portrait };
}

function bridgeItem(system, id, kind, title, detail, at, isNew, link = null) {
  return { id, system, kind, title, detail, at, new: isNew, link };
}

const BRIDGE_SYSTEMS = [
  {
    id: "agents",
    name: "Workshop",
    resident: bridgeResident("robot", "Bolt", "/assets/characters/bolt.png"),
    status: "healthy",
    voice: "Two things on the bench still want a look. Nothing's on fire — but they're yours when you're ready.",
    counts: { arrivals: 2, have_tos: 2 },
    source: { name: "Project Home", observed_at: "2026-09-25T08:40:00Z", freshness: "fresh" },
    items: [
      bridgeItem("agents", "agents:pr-review", "have_to", "Review the Play-Nice contract bump", "A dependency refresh is waiting on your call.", "2026-09-25T08:30:00Z", true, { label: "Open Projects", href: null, area: "projects" }),
      bridgeItem("agents", "agents:tool-failure", "have_to", "A tool run failed overnight", "Nothing was damaged; the retry is queued.", "2026-09-25T07:10:00Z", true),
      bridgeItem("agents", "agents:bookmark-onboarding", "arrival", "Personal World: polish the onboarding copy", "Next action: review accessibility before the merge.", "2026-09-24T19:00:00Z", false),
      bridgeItem("agents", "agents:bookmark-docs", "arrival", "Personal World: finish the briefing docs", "Next action: write down the place contract.", "2026-09-24T16:20:00Z", false),
    ],
  },
  {
    id: "estate",
    name: "Engine room",
    resident: bridgeResident("hekek", "Hekek", "/assets/characters/hekek.png"),
    status: "warning",
    voice: "Two rows want tending. A patch will hold until a proper repair — your call.",
    counts: { arrivals: 1, have_tos: 2 },
    source: { name: "lab lowbw", observed_at: "2026-09-25T08:45:00Z", freshness: "fresh" },
    items: [
      bridgeItem("estate", "estate:urgent-backup", "have_to", "The backup volume is nearly full", "Trim old snapshots, or grow the volume.", "2026-09-25T08:20:00Z", true),
      bridgeItem("estate", "estate:urgent-cert", "have_to", "A service certificate expires soon", "Renew it before it lapses; nothing is down yet.", "2026-09-24T22:00:00Z", false),
      bridgeItem("estate", "estate:review-log", "arrival", "New review rows in the lab packet", "Three observations are ready to read.", "2026-09-25T07:55:00Z", true),
    ],
  },
  {
    id: "records",
    name: "Archive",
    resident: bridgeResident("bruma", "Bruma", "/assets/characters/bruma.png"),
    status: "healthy",
    voice: "I kept your last note safe. Would you like the original, or the summary?",
    counts: { arrivals: 1, have_tos: 1 },
    source: { name: "journal", observed_at: "2026-09-25T08:50:00Z", freshness: "fresh" },
    items: [
      bridgeItem("records", "records:thread-latest", "thread", "Picked the calm-hub direction; the loop comes first.", "Your own words, from your latest entry.", "2026-09-24T18:00:00Z", true, { label: "Open Memory", href: null, area: "memory" }),
      bridgeItem("records", "records:have-to-review", "have_to", "A record wants a second look", "One pinned record may be out of date.", "2026-09-24T12:00:00Z", false, { label: "Open Memory", href: null, area: "memory" }),
    ],
  },
  {
    id: "interests",
    name: "Observatory",
    resident: bridgeResident("mira", "Mira", "/assets/characters/mira.png"),
    status: "healthy",
    voice: "I noticed a pattern in what you've been reading. I'll keep watching.",
    counts: { arrivals: 0, have_tos: 0 },
    source: { name: "discovery", observed_at: "2026-09-25T08:30:00Z", freshness: "fresh" },
    items: [
      bridgeItem("interests", "interests:find-1", "interest", "Self-hosting keeps coming up", "A source you follow published about it.", "2026-09-23T10:00:00Z", false),
    ],
  },
  {
    id: "news",
    name: "Newsstand",
    resident: bridgeResident("taco-news-truck", "Burrito Journalism", "/assets/characters/burrito.png"),
    status: "not_configured",
    voice: "No feed plugged in yet — the truck's parked and the paper's blank. Nothing to report, honestly.",
    counts: { arrivals: 0, have_tos: 0 },
    source: { name: "media", observed_at: null, freshness: "unknown" },
    items: [],
  },
  {
    id: "threads",
    name: "World tree",
    resident: bridgeResident("world-tree-squirrel", "Ratatoskr", "/assets/characters/ratatoskr.png"),
    status: "unavailable",
    voice: "The branch I climb is out of reach right now. I'll carry word when it's back — until then, nothing.",
    counts: { arrivals: 0, have_tos: 0 },
    source: { name: "place + last thread", observed_at: null, freshness: "unknown" },
    items: [],
  },
];

const BRIDGE_SYSTEM_IDS = BRIDGE_SYSTEMS.map((s) => s.id);

function bridgeFixture() {
  const byNewest = (a, b) => ((a.at ?? "") < (b.at ?? "") ? 1 : -1);
  const haveTo = BRIDGE_SYSTEMS.flatMap((s) => s.items.filter((i) => i.kind === "have_to")).sort(byNewest);
  const arrivals = BRIDGE_SYSTEMS.flatMap((s) => s.items.filter((i) => i.kind !== "have_to")).sort(byNewest).slice(0, 5);
  return {
    schema: "worlds-briefing/1",
    generated_at: "2026-09-25T09:00:00Z",
    since: "2026-09-24T17:00:00Z",
    keeper: {
      line: "Two things need you, and the Workshop has been busy. Take your time — the bridge holds.",
      mood: "busy",
      resident: bridgeResident("assistant", "Assistant", "/assets/crew/256/assistant-portrait.webp"),
    },
    systems: BRIDGE_SYSTEMS,
    have_tos: haveTo.slice(0, 3),
    have_tos_total: haveTo.length,
    arrivals,
    thread: BRIDGE_SYSTEMS.flatMap((s) => s.items).find((i) => i.kind === "thread") ?? null,
  };
}

// Continuity: the stored place (per-person on the real station). Null on
// a first visit; PUT stamps updated_at, which the next briefing's
// `since` would carry.
let PLACE = null;

// ── Rooms fixtures (contract room/0) ─────────────────────────────────
// The front door renders other small backends without owning their
// code. One healthy room with a need, one degraded room with none, and
// one unreachable room that keeps a last-seen time — so the estate
// panel always exercises all three honest states. Fiction only.
// The person's crew (crew.py): starter crew, keepers, and visits.
// Mutable for the crew page's flows; reset by DELETE /api/__test/reset.
const STARTER_CREW = [
  ["renai", "Renai", "renai-hello"],
  ["bolt", "Bolt", "bolt-portrait"],
  ["hekek", "Hekek", "hekek-portrait"],
  ["ratatoskr", "Ratatoskr", "ratatoskr-portrait"],
  ["bruma", "Bruma", "bruma-portrait"],
  ["mira", "Mira", "mira-portrait"],
  ["scoop", "Scoop", "scoop-portrait"],
].map(([id, name, stem]) => ({
  id,
  name,
  blurb: null,
  voice_label: null,
  portrait_asset: `/assets/crew/512/${stem}.webp`,
  full_body_asset: null,
  source: "starter",
  hidden: false,
}));
// crew.default_keepers: only Workshop starts with a keeper (Bolt, canon);
// Studio has none until the person picks one (owner nixed a default, #85).
const KEEPERS_SEED = { workshop: "bolt" };
let DOORWAYS = {};
const DOORWAY_IDS = new Set(["study", "archive", "garden", "kitchen", "lounge", "music", "observatory", "post", "travel", "vault", "wellness", "hallway", "servers"]);
let CREW = structuredClone(STARTER_CREW);
let KEEPERS = { ...KEEPERS_SEED };
let VISITS = {};
let RESUME = null;
const SEEN = {};

function keeperOf(roomId) {
  const entry = CREW.find((c) => c.id === KEEPERS[roomId]);
  if (!entry) return null;
  return {
    id: entry.id,
    name: entry.name,
    portrait_url: entry.portrait_asset,
    initial: entry.name.trim().charAt(0).toUpperCase(),
  };
}

const SECRETS_OVERVIEW = {
  station: { configured: true, status: "ok", detail: null },
  namespaces: [
    { name: "rooms", keys: ["rooms/workshop-token", "rooms/studio-token"] },
    { name: "mail", keys: ["mail/relay-password"] },
  ],
  key_count: 3,
  bundle_last_change: "2026-09-25T22:52:00Z",
  requests: [
    {
      id: "req-1",
      key_path: "mail/relay-password",
      reason: "The weekly digest can't send without the mail relay's password.",
      requested_at: "2026-09-25T22:40:00Z",
      link: "/secrets?request=req-1",
    },
  ],
  recent_ops: [
    { key_path: "rooms/workshop-token", state: "pushed", deploy_state: "verified", actor: "owner", created_at: "2026-09-25T09:12:00Z" },
  ],
  room_id: "workshop",
  open_url: "https://room.test/secrets",
};

function decoratedRooms() {
  return ROOMS_FIXTURE.map((row) => ({
    ...row,
    last_visited_at: VISITS[row.id] ?? null,
    needs_seen: SEEN[row.id] ?? [],
    changed_since_visit: 0,
    keeper: keeperOf(row.id),
    doorway: DOORWAYS[row.id] ?? null,
  }));
}

function slug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "companion";
  let id = base;
  for (let i = 2; CREW.some((c) => c.id === id); i++) id = `${base}-${i}`;
  return id;
}

const ROOMS_FIXTURE = [
  {
    id: "studio",
    base_url: "http://127.0.0.1:8940",
    reachable: true,
    status: "healthy",
    room: {
      contract: "room/0",
      id: "studio",
      name: "Studio",
      icon: "book",
      voice: "dry and precise",
      version: "1.2.0",
      commit: "a1b2c3d",
      status: "healthy",
      updated_at: "2026-09-25T13:05:48Z",
    },
    needs_you: [
      {
        id: "need-1",
        title: "Confirm the transfer",
        why: "A withdrawal above the usual threshold is waiting.",
        actions: ["confirm-transfer"],
        created_at: "2026-09-25T12:30:00Z",
        link: "/transfers/1",
      },
    ],
    // room/0 cards, one per tone; the unknown tone reads as an update.
    cards: [
      {
        id: "card-1",
        title: "Chapter three drafted",
        body: "The outline is filled in through the ending.",
        link: "/drafts/3",
        lane: "personal",
        tone: "good_news",
        freshness: { observed_at: "2026-09-25T13:00:00Z", stale_after_s: 315360000 },
      },
      {
        id: "card-2",
        title: "Two notes to file",
        body: "From yesterday's reading.",
        link: "/notes",
        lane: "personal",
        tone: "when_ready",
        freshness: { observed_at: "2026-09-25T11:00:00Z", stale_after_s: 315360000 },
      },
      {
        id: "card-3",
        title: "Weekly word count",
        link: "//not-a-safe-link.test",
        lane: "work",
        freshness: { observed_at: "2026-09-24T18:00:00Z", stale_after_s: 315360000 },
      },
    ],
    error: null,
    checked_at: "2026-09-25T13:10:00Z",
    last_seen: "2026-09-25T13:10:00Z",
  },
  {
    id: "workshop",
    base_url: "https://room.test",
    reachable: true,
    status: "degraded",
    room: {
      contract: "room/0",
      id: "workshop",
      name: "Workshop",
      icon: "hammer",
      voice: "plain and steady",
      version: "0.9.0",
      commit: "b2c3d4e",
      status: "degraded",
      updated_at: "2026-09-25T13:00:00Z",
    },
    needs_you: [],
    error: null,
    checked_at: "2026-09-25T13:10:00Z",
    last_seen: "2026-09-25T13:10:00Z",
  },
  {
    id: "cellar",
    base_url: "http://127.0.0.1:9000",
    reachable: false,
    status: "unreachable",
    room: null,
    needs_you: [],
    error: "connect error",
    checked_at: "2026-09-25T13:10:00Z",
    last_seen: "2026-09-25T12:00:00Z",
  },
];

// ── Records fixtures (Lane R-FE, 2026-09-21) ─────────────────────────
// Envelope shapes copied verbatim from docs/RECORDS-API.md and
// tests/test_records.py + api.py records_*: category rows are
// {slug,name,locked,count,pinned-count}; record values are
// {id,category,category_name,title,fields,pinned,created,updated};
// a locked read without fresh step-up is the HARD 409
// {ok:false,status:"locked",category,warnings:[…]}; not_found writes
// are 200 + {ok:false,status:"not_found"}; and with no provider the
// whole surface answers 200 + {ok:false,status:"unavailable",
// warnings:["no memory provider"]}. Fiction only — Z999 is fixture
// material, never a real document.
const RECORD_CATS = [
  { slug: "medical", name: "Medical", locked: false },
  { slug: "identity-documents", name: "Identity documents", locked: true },
];
const RECORD_ITEMS = [
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
// The elevation seam (mirrors _step_up_authorized's session-grant
// mechanism). Seeded granted like a loopback session on the real
// station; specs exercise the 409 invitation through page.route
// overrides so parallel workers never race this flag.
let RECORD_STEP_UP_GRANTED = true;
let recordSeq = 0;

const categorySlug = (value) =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function recordCategoryRows() {
  return RECORD_CATS.map((c) => ({
    slug: c.slug,
    name: c.name,
    locked: c.locked,
    count: RECORD_ITEMS.filter((r) => r.category === c.slug).length,
    pinned: RECORD_ITEMS.filter((r) => r.category === c.slug && r.pinned).length,
  })).sort((a, b) => (a.slug < b.slug ? -1 : 1));
}

function recordsRoutes(req, res, url, method) {
  const cat = (slug) => RECORD_CATS.find((c) => c.slug === slug);

  if (method === "GET" && url.pathname === "/api/records/categories") {
    return json(res, 200, ok("healthy", { categories: recordCategoryRows() }));
  }

  if (url.pathname === "/api/records") {
    if (method === "GET") {
      const category = url.searchParams.get("category");
      const pinned = url.searchParams.get("pinned") === "true";
      // ?q= — the deterministic lexical find (api.py records_list +
      // records.search_records): case-insensitive AND-substring over
      // title, category name, and field keys/values; locked categories
      // only join results behind the step-up grant (fail closed).
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const matchesQ = (r) => {
        if (q === "") return true;
        const terms = q.split(/\s+/).filter(Boolean);
        const hay = [
          r.title,
          r.category_name,
          ...Object.entries(r.fields ?? {}).flatMap(([k, v]) => [
            k,
            v == null ? "" : String(v),
          ]),
        ]
          .join("\n")
          .toLowerCase();
        return terms.every((t) => hay.includes(t));
      };
      const byFindOrder = (a, b) =>
        a.updated === b.updated
          ? a.id < b.id ? 1 : -1
          : a.updated < b.updated ? 1 : -1;
      if (category !== null) {
        const slug = categorySlug(category);
        if (!slug) return json(res, 422, { detail: "category is required" });
        const c = cat(slug);
        if (c && c.locked && !RECORD_STEP_UP_GRANTED) {
          // The honest HARD refusal — 409, never a softened 200.
          return json(res, 409, {
            ok: false,
            status: "locked",
            category: slug,
            warnings: [`category '${slug}' is locked: step-up required to read`],
          });
        }
        let recs = RECORD_ITEMS.filter((r) => r.category === slug).sort((a, b) =>
          a.created < b.created ? -1 : 1,
        );
        if (q !== "") recs = recs.filter(matchesQ).sort(byFindOrder);
        if (pinned) recs = recs.filter((r) => r.pinned);
        return json(res, 200, ok("healthy", {
          category: slug,
          locked: Boolean(c && c.locked),
          records: recs,
          ...(q !== "" ? { query: q } : {}),
        }));
      }
      if (q !== "") {
        let recs = RECORD_ITEMS.filter(
          (r) => RECORD_STEP_UP_GRANTED || !cat(r.category)?.locked,
        )
          .filter(matchesQ)
          .sort(byFindOrder);
        if (pinned) recs = recs.filter((r) => r.pinned);
        return json(res, 200, ok("healthy", { records: recs, query: q }));
      }
      if (pinned) {
        // The Overview feed never aggregates locked categories.
        return json(res, 200, ok("healthy", {
          records: RECORD_ITEMS.filter((r) => r.pinned && !cat(r.category)?.locked).sort(
            (a, b) => (a.updated > b.updated ? -1 : 1),
          ),
        }));
      }
      return json(res, 200, ok("healthy", {
        records: RECORD_ITEMS.filter((r) => !cat(r.category)?.locked).sort(
          (a, b) => (a.created > b.created ? -1 : 1),
        ),
      }));
    }

    if (method === "POST") {
      // Create/update — the step-up ACT (mock session is elevated).
      return readBody(req).then((body) => {
        if (body === null) return json(res, 400, { detail: "body must be JSON" });
        if (typeof body !== "object" || Array.isArray(body)) {
          return json(res, 400, { detail: "body must be an object" });
        }
        if (!("title" in body)) return json(res, 422, { detail: "title is required" });
        const title = String(body.title ?? "").trim();
        const slug = categorySlug(body.category);
        if (!title || title.length > 200) {
          return json(res, 422, { detail: "title must be 1-200 chars" });
        }
        if (!slug) return json(res, 422, { detail: "category is required" });
        let c = cat(slug);
        if (!c) {
          c = { slug, name: String(body.category).trim().slice(0, 80), locked: false };
          RECORD_CATS.push(c);
        }
        if (body.locked !== undefined) {
          if (typeof body.locked !== "boolean") {
            return json(res, 422, { detail: "locked must be a boolean" });
          }
          c.locked = body.locked;
        }
        if (body.fields !== undefined && body.fields !== null) {
          if (typeof body.fields !== "object" || Array.isArray(body.fields)) {
            return json(res, 422, { detail: "fields must be an object of key -> value" });
          }
          for (const [k, v] of Object.entries(body.fields)) {
            const bad =
              v !== null &&
              typeof v !== "string" &&
              typeof v !== "number" &&
              typeof v !== "boolean";
            if (bad) {
              return json(res, 422, { detail: `field '${k}' must be a scalar (string, number, bool, or null)` });
            }
          }
        }
        const iso = new Date().toISOString();
        const existing = body.id
          ? RECORD_ITEMS.find((r) => r.id === String(body.id))
          : undefined;
        if (existing) {
          existing.title = title;
          existing.fields = body.fields ?? existing.fields;
          existing.category = slug;
          existing.category_name = c.name;
          existing.updated = iso;
          return json(res, 200, ok("healthy", { ...existing }));
        }
        const rec = {
          id: `${slugOfTitle(title)}-e2e${(recordSeq += 1)}`,
          category: slug,
          category_name: c.name,
          title,
          fields: body.fields ?? {},
          pinned: false,
          created: iso,
          updated: iso,
        };
        RECORD_ITEMS.push(rec);
        return json(res, 200, ok("healthy", rec));
      });
    }

    if (method === "DELETE") {
      return readBody(req).then((body) => {
        if (body === null) return json(res, 400, { detail: "body must be JSON" });
        const slug = categorySlug(body.category);
        const i = RECORD_ITEMS.findIndex((r) => r.category === slug && r.id === body.id);
        if (i === -1) {
          return json(res, 200, {
            ok: false,
            status: "not_found",
            warnings: ["no such record"],
          });
        }
        RECORD_ITEMS.splice(i, 1);
        return json(res, 200, ok("healthy", { deleted: true }));
      });
    }
  }

  if ((method === "POST") && (url.pathname === "/api/records/pin" || url.pathname === "/api/records/unpin")) {
    const pinned = url.pathname.endsWith("/pin");
    return readBody(req).then((body) => {
      if (body === null) return json(res, 400, { detail: "body must be JSON" });
      const slug = categorySlug(body.category);
      const rec = RECORD_ITEMS.find((r) => r.category === slug && r.id === body.id);
      if (!rec) {
        return json(res, 200, {
          ok: false,
          status: "not_found",
          warnings: ["no such record"],
        });
      }
      rec.pinned = pinned;
      rec.updated = new Date().toISOString();
      return json(res, 200, ok("healthy", { ...rec }));
    });
  }

  return null;
}

const slugOfTitle = (title) => categorySlug(title).slice(0, 40) || "record";

let vaultLocked = true;
// In-memory secret store (fixture fiction, like the journal): the
// names list and per-name routes read/write THIS, so set/delete
// behave like the server's _vault within a run.
const SECRETS = new Map([["E2E_FIXTURE_TOKEN", "fixture-value-not-a-secret"]]);

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    "access-control-allow-origin": "*",
  });
  res.end(payload);
}

function notFound(res) {
  json(res, 404, { detail: "Not Found" });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const p = url.pathname;
  const method = req.method ?? "GET";

  if (method === "GET" && p === "/healthz") {
    return json(res, 200, { ok: true, auth_configured: true, setup_needed: false, dev_bypass: false });
  }
  if (method === "GET" && p === "/api/setup/status") {
    return json(res, 200, ok("healthy", { complete: true }));
  }
  if (method === "GET" && p === "/api/status") {
    return json(res, 200, {
      ok: true,
      status: "healthy",
      data: { ...WORLD_SUMMARY, capabilities: CAPABILITIES, actors: [
        { name: "native", role: "source_control", provider: "native", capabilities: ["source_control"], status: "healthy", secrets: "none", writes: "none" },
      ] },
    });
  }
  if (method === "GET" && p === "/api/daily") {
    return json(res, 200, {
      ok: true, status: "healthy", changed: false, warnings: [], actions: [],
      data: { world: WORLD_SUMMARY, capabilities: CAPABILITIES, attention: [] },
    });
  }
  if (method === "GET" && p === "/api/actors") {
    return json(res, 200, ok("healthy", [
      { name: "native", role: "source_control", provider: "native", capabilities: ["source_control"], status: "healthy", secrets: "none", writes: "none" },
    ]));
  }
  if (method === "GET" && p === "/api/prefs") {
    return json(res, 200, ok("healthy", PREFS));
  }
  if (method === "GET" && p === "/api/prefs/schema") {
    return json(res, 200, ok("healthy", PREFS_SCHEMA));
  }
  if (method === "PUT" && p === "/api/prefs") {
    const body = await readBody(req);
    if (body === null) return json(res, 400, { detail: "body must be JSON" });
    // Same discipline as prefs.set_prefs: unknown keys or values
    // outside the server vocabulary answer 400 with every reason;
    // nothing applies unless the whole body validates.
    const errors = [];
    for (const [key, value] of Object.entries(body)) {
      const spec = PREFS_SCHEMA[key];
      if (!spec) {
        errors.push(`unknown preference '${key}'`);
        continue;
      }
      if (!spec.allowed.includes(value)) {
        errors.push(`${key}: ${JSON.stringify(value)} is not an allowed value`);
        continue;
      }
    }
    if (errors.length > 0) {
      return json(res, 400, { detail: errors.join("; ") });
    }
    Object.assign(PREFS, body);
    return json(res, 200, ok("healthy", { ...PREFS }));
  }
  if (method === "GET" && p === "/api/discovery/status") {
    return json(res, 200, ok("healthy", {
      sources: DISCOVERY_SOURCES,
      interests: DISCOVERY_INTERESTS,
      items: [],
      source_count: DISCOVERY_SOURCES.length,
      interest_count: DISCOVERY_INTERESTS.length,
      item_count: 0,
    }));
  }
  if (method === "GET" && p === "/api/discovery/discover") {
    const enabled = DISCOVERY_SOURCES.filter((s) => s.enabled).length;
    return json(res, 200, ok("healthy", {
      items: DISCOVERY_FINDS,
      count: DISCOVERY_FINDS.length,
      sources_queried: enabled,
    }));
  }
  // GET /api/projects/status — mirrors api.py projects_status over the
  // agent-sync sensor (providers/agent_sync.py _normalize): a dated
  // observation of normalized play-nice/repo-status-v1 rows. Fiction
  // only; remote_url is the row's authoritative source link.
  if (method === "GET" && p === "/api/projects/status") {
    return json(res, 200, ok("healthy", {
      observed_at: "2026-09-22T08:00:00Z",
      freshness: "fresh",
      age_seconds: 120,
      projects: [
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
      ],
    }));
  }
  if (p === "/api/sections" && (method === "GET" || method === "PUT")) {
    return json(res, 200, ok("healthy", { schema: "sections.v1", sections: SECTIONS }));
  }
  // GET /api/briefing — mirrors api.py briefing(): one dated read of
  // the whole world. `since` is the last place the person stood, so
  // the Keeper can greet with continuity. Fiction only.
  if (method === "GET" && p === "/api/briefing") {
    return json(res, 200, ok("needs_attention", bridgeFixture()));
  }
  // GET /api/place — the stored place, or an honest null on a first
  // visit (never a fabricated default; the UI chooses its own).
  if (method === "GET" && p === "/api/place") {
    return json(res, 200, ok("healthy", { place: PLACE }));
  }
  // PUT /api/place — per-person, atomic, no step-up. An unknown
  // system is a 422, exactly like api.py place_put().
  if (method === "PUT" && p === "/api/place") {
    const body = await readBody(req);
    if (body === null) return json(res, 400, { detail: "body must be JSON" });
    const system = body.system === null || body.system === undefined ? null : String(body.system);
    if (system !== null && !BRIDGE_SYSTEM_IDS.includes(system)) {
      return json(res, 422, { detail: `unknown system '${system}'` });
    }
    const itemId = body.item_id === null || body.item_id === undefined ? null : String(body.item_id);
    PLACE = { system, item_id: itemId, updated_at: new Date().toISOString() };
    return json(res, 200, ok("healthy", { place: PLACE }));
  }
  // GET /api/secrets/overview — the Workshop's secrets by NAME (owner
  // only; synthetic names, never a value).
  if (method === "GET" && p === "/api/secrets/overview") {
    return json(res, 200, { ok: true, data: SECRETS_OVERVIEW });
  }
  // GET /api/rooms — the estate's rooms (contract room/0): one honest
  // row per configured room. An unreachable room is data, not an error.
  if (method === "GET" && p === "/api/rooms") {
    const rows = decoratedRooms();
    const needs = rows.reduce(
      (n, r) => n + (r.reachable ? r.needs_you.filter((x) => !r.needs_seen.includes(x.id)).length : 0),
      0,
    );
    return json(res, 200, {
      ...ok("healthy", rows),
      resume: RESUME,
      summary: {
        needs_you: needs,
        changed: 0,
        can_wait: 0,
        unknown: 0,
        unreachable: rows.filter((r) => !r.reachable).length,
      },
    });
  }
  const visitMatch = p.match(/^\/api\/rooms\/([^/]+)\/visit$/);
  if (method === "POST" && visitMatch) {
    const roomId = decodeURIComponent(visitMatch[1]);
    if (!ROOMS_FIXTURE.some((r) => r.id === roomId)) return json(res, 404, { detail: "unknown room" });
    const body = (await readBody(req)) ?? {};
    const at = new Date().toISOString();
    VISITS[roomId] = at;
    RESUME = { room_id: roomId, title: body.title ?? null, link: body.link ?? null, at };
    return json(res, 200, { ok: true, data: { room_id: roomId, last_visited_at: at, resume: RESUME } });
  }
  const seenMatch = p.match(/^\/api\/rooms\/([^/]+)\/needs\/([^/]+)\/seen$/);
  if (method === "POST" && seenMatch) {
    const roomId = decodeURIComponent(seenMatch[1]);
    const needId = decodeURIComponent(seenMatch[2]);
    if (!ROOMS_FIXTURE.some((r) => r.id === roomId)) return json(res, 404, { detail: "unknown room" });
    SEEN[roomId] = [...new Set([...(SEEN[roomId] ?? []), needId])];
    return json(res, 200, { ok: true, data: { room_id: roomId, need_id: needId, needs_seen: SEEN[roomId] } });
  }
  const doorMatch = p.match(/^\/api\/rooms\/([^/]+)\/doorway$/);
  if (method === "PUT" && doorMatch) {
    const roomId = decodeURIComponent(doorMatch[1]);
    if (!ROOMS_FIXTURE.some((r) => r.id === roomId)) return json(res, 404, { detail: "unknown room" });
    const body = (await readBody(req)) ?? {};
    if (!("doorway_id" in body)) return json(res, 422, { detail: "doorway_id is required" });
    const id = body.doorway_id;
    if (id !== null && !DOORWAY_IDS.has(id)) return json(res, 422, { detail: "doorway_id must be one of the library" });
    DOORWAYS[roomId] = id;
    return json(res, 200, { ok: true, data: { room_id: roomId, doorway: DOORWAYS[roomId] ?? null } });
  }
  const keeperMatch = p.match(/^\/api\/rooms\/([^/]+)\/keeper$/);
  if (method === "PUT" && keeperMatch) {
    const roomId = decodeURIComponent(keeperMatch[1]);
    if (!ROOMS_FIXTURE.some((r) => r.id === roomId)) return json(res, 404, { detail: "unknown room" });
    const body = (await readBody(req)) ?? {};
    const id = body.companion_id ?? null;
    if (id !== null && !CREW.some((c) => c.id === id)) return json(res, 422, { detail: "unknown companion" });
    KEEPERS[roomId] = id;
    return json(res, 200, { ok: true, data: { room_id: roomId, keeper: keeperOf(roomId) } });
  }
  // Crew (api.py crew_*): per person; starters are hidden, never deleted.
  if (method === "GET" && p === "/api/crew") {
    return json(res, 200, { ok: true, data: CREW });
  }
  if (method === "POST" && p === "/api/crew") {
    const body = (await readBody(req)) ?? {};
    const name = String(body.name ?? "").trim();
    if (!name) return json(res, 422, { detail: "name is required" });
    const entry = {
      id: slug(name),
      name,
      blurb: body.blurb ?? null,
      voice_label: body.voice_label ?? null,
      portrait_asset: null,
      full_body_asset: null,
      source: "user",
      hidden: false,
    };
    CREW.push(entry);
    return json(res, 200, { ok: true, data: entry });
  }
  const crewMatch = p.match(/^\/api\/crew\/([^/]+)$/);
  if (crewMatch && (method === "PATCH" || method === "DELETE")) {
    const id = decodeURIComponent(crewMatch[1]);
    const entry = CREW.find((c) => c.id === id);
    if (!entry) return json(res, 404, { detail: "unknown companion" });
    if (method === "DELETE") {
      if (entry.source === "starter") {
        return json(res, 409, { detail: "starter companions cannot be deleted; hide it instead" });
      }
      CREW = CREW.filter((c) => c.id !== id);
      const cleared = Object.keys(KEEPERS).filter((r) => KEEPERS[r] === id).sort();
      for (const r of cleared) KEEPERS[r] = null;
      return json(res, 200, { ok: true, data: { id, deleted: true, keepers_cleared: cleared } });
    }
    const body = (await readBody(req)) ?? {};
    for (const key of ["name", "blurb", "voice_label", "hidden"]) {
      if (key in body) entry[key] = body[key];
    }
    return json(res, 200, { ok: true, data: entry });
  }
  // Test-only fixture reset (see CURRENT_SEED) — restores the seeded
  // journal/superseded/draft state. Never mirrored in api.py by design.
  if (method === "DELETE" && p === "/api/__test/reset") {
    CURRENT.length = 0;
    CURRENT.push(...structuredClone(CURRENT_SEED));
    SUPERSEDED.length = 0;
    SUPERSEDED.push(...structuredClone(SUPERSEDED_SEED));
    DRAFT = null;
    PLACE = null;
    CREW = structuredClone(STARTER_CREW);
    KEEPERS = { ...KEEPERS_SEED };
    DOORWAYS = {};
    VISITS = {};
    RESUME = null;
    for (const k of Object.keys(SEEN)) delete SEEN[k];
    return json(res, 200, ok("healthy", { reset: true }));
  }
  if (method === "GET" && p === "/api/journal") {
    const n = Math.min(Math.max(Number(url.searchParams.get("n") ?? 20), 1), 500);
    return json(res, 200, { ok: true, data: CURRENT.slice(0, n) });
  }
  // The thread deep-link contract (api.py journal_last): the newest
  // CURRENT entry, or an honest null — never a fabrication, never a
  // superseded original (CURRENT only holds current versions).
  if (method === "GET" && p === "/api/journal/last") {
    const newest = CURRENT.reduce(
      (a, b) => (a === null || b.ts > a.ts ? b : a),
      null,
    );
    return json(res, 200, { ok: true, status: "healthy", data: { entry: newest } });
  }
  if (method === "POST" && p === "/api/journal") {
    const body = await readBody(req);
    const text = String(body?.text ?? "").trim();
    if (!text || text.length > 2000) {
      return json(res, 422, { detail: "text must be 1-2000 chars" });
    }
    const ts = new Date().toISOString();
    CURRENT.unshift(journalEvent(ts, text));
    return json(res, 200, { ok: true, data: { written: text.length } });
  }
  // Journal drafts — mirrors api.py journal_draft_* exactly: the PUT
  // response reports {saved_at, length} and NEVER echoes text.
  if (method === "PUT" && p === "/api/journal/draft") {
    const body = await readBody(req);
    const text = String(body?.text ?? "");
    if (text.length > 100_000) {
      return json(res, 422, { detail: "draft exceeds 100000 chars" });
    }
    const stamp = new Date().toISOString();
    DRAFT = {
      text,
      entry_id: String(body?.entry_id ?? ""),
      device: String(body?.device ?? ""),
      updated_at: stamp,
    };
    return json(res, 200, { ok: true, data: { saved_at: stamp, length: text.length } });
  }
  if (method === "GET" && p === "/api/journal/draft") {
    return json(res, 200, {
      ok: true,
      data: DRAFT
        ? { ...DRAFT, length: DRAFT.text.length }
        : { text: null, updated_at: null },
    });
  }
  if (method === "DELETE" && p === "/api/journal/draft") {
    DRAFT = null;
    return json(res, 200, { ok: true, data: { cleared: true } });
  }
  if (method === "POST" && p === "/api/journal/supersede") {
    const body = await readBody(req);
    const targetTs = String(body?.supersedes ?? "").trim();
    const corrected = String(body?.text ?? "").trim();
    const reason = String(body?.reason ?? "").trim();
    if (!targetTs || !corrected) {
      return json(res, 422, { detail: "supersedes (entry timestamp) and text are required" });
    }
    const old = CURRENT.find((e) => e.ts === targetTs);
    if (!old) {
      return json(res, 200, {
        ok: false, status: "not_configured",
        warnings: [`no journal entry found at ${targetTs}`],
      });
    }
    const ts = new Date().toISOString();
    const next = journalEvent(ts, corrected, { supersedes: targetTs, supersede_reason: reason || null });
    CURRENT.splice(CURRENT.indexOf(old), 1, next);
    SUPERSEDED.push(old);
    return json(res, 200, {
      ok: true, status: "healthy",
      data: { current: next, superseded: old, audit: journalEvent(ts, "entry superseded", { supersedes: targetTs }), already_applied: false },
    });
  }
  if (method === "GET" && p === "/api/journal/history") {
    const ts = url.searchParams.get("ts") ?? "";
    const head = [...CURRENT, ...SUPERSEDED].find((e) => e.ts === ts);
    if (!head) {
      return json(res, 200, {
        ok: false, status: "not_configured",
        warnings: [`no journal entry found at ${ts}`],
      });
    }
    const chain = [head];
    let cursor = head;
    while (cursor.supersedes) {
      const prev = [...CURRENT, ...SUPERSEDED].find((e) => e.ts === cursor.supersedes);
      if (!prev) break;
      chain.unshift(prev);
      cursor = prev;
    }
    return json(res, 200, { ok: true, status: "healthy", data: { entries: chain } });
  }
  if (method === "GET" && p === "/api/journal/audit") {
    return json(res, 200, { ok: true, data: { text: "journal audit (e2e fixture)" } });
  }
  // Memory search — mirrors api.py memory_search + native_memory.py
  // search(): the provider indexes JOURNAL ENTRIES and answers
  // {ok, status, data:{results:[{id,kind,text,timestamp}], query,
  // count}}. The fixture search is a plain substring scan over the
  // same in-memory journal (the real engine is SQLite FTS — same
  // contract shape, less machinery). Refusal shape (ok:false,
  // warnings) is what the server answers when no memory provider is
  // configured; the fixture provider is configured, so results.
  if (method === "GET" && p === "/api/memory/search") {
    const q = url.searchParams.get("q") ?? "";
    const topK = Math.min(Math.max(Number(url.searchParams.get("top_k") ?? 5), 1), 50);
    if (!q) return json(res, 422, { detail: "q is required" });
    const needle = q.toLowerCase();
    const results = CURRENT.filter((e) => e.summary.toLowerCase().includes(needle))
      .slice(0, topK)
      .map((e) => ({ id: `journal:${e.ts}`, kind: e.kind, text: e.summary, timestamp: e.ts }));
    return json(res, 200, ok("healthy", { results, query: q, count: results.length }));
  }
  if (method === "POST" && p === "/api/chat") {
    const body = await readBody(req);
    const message = String(body?.message ?? "").trim();
    if (!message) return json(res, 400, { detail: "message is required" });
    const now = Date.now() / 1000;
    const reply = "Noted — this is a fixture reply served by the e2e mock station, not a live model.";
    TRANSCRIPT = [
      ...TRANSCRIPT,
      { ts: now, role: "user", content: message },
      { ts: now + 0.2, role: "assistant", content: reply, provider: "ollama" },
    ];
    return json(res, 200, {
      ok: true, status: "healthy", changed: false, warnings: [], actions: [],
      data: { reply, provider: "ollama" },
    });
  }
  if (method === "GET" && p === "/api/chat/history") {
    const n = Math.min(Math.max(Number(url.searchParams.get("n") ?? 50), 1), 500);
    const entries = TRANSCRIPT.slice(-n);
    return json(res, 200, { ok: true, data: { entries, count: entries.length } });
  }
  if (method === "GET" && p === "/api/chat/providers") {
    return json(res, 200, ok("healthy", {
      providers: [{ name: "ollama", display_name: "Ollama (local)", status: "healthy", ok: true }],
      active: "ollama",
    }));
  }
  if (method === "GET" && p === "/api/auth/session") {
    return json(res, 200, {
      ok: true,
      data: { principal_id: "person:operator", auth_method: "instance-token", has_step_up: RECORD_STEP_UP_GRANTED },
    });
  }
  // POST /api/auth/step-up — auth_routes.py auth_step_up verbatim:
  // a credential event (empty token fails closed 403), a bounded
  // grant, and NO status key on success ({ok, data} only).
  if (method === "POST" && p === "/api/auth/step-up") {
    const body = await readBody(req);
    const token = String(body?.token ?? "").trim();
    if (!token) return json(res, 403, { detail: "step-up credential invalid" });
    RECORD_STEP_UP_GRANTED = true;
    return json(res, 200, {
      ok: true,
      data: { has_step_up: true, expires_in: 300, principal_id: "person:operator" },
    });
  }
  // Records — Memory's structured half (docs/RECORDS-API.md). The
  // router returns null only when no route matched.
  {
    const handled = recordsRoutes(req, res, url, method);
    if (handled !== null) return handled;
  }
  if ((method === "GET" || method === "PUT") && p === "/api/identity/principal") {
    return json(res, 200, ok("healthy", {
      id: "person:operator", kind: "person", display_name: "Operator",
      scopes: ["admin"], source: "instance-token",
    }));
  }
  if (method === "GET" && p === "/api/brain/templates") {
    return json(res, 200, ok("healthy", {
      templates: [{ id: "daily-digest", version: "1", kind: "task", surface: "daily", max_tokens: 900, source: "shipped", description: "Compose the daily digest.", content_length: 180, has_override: false }],
    }));
  }
  if (method === "GET" && p === "/api/manifest") {
    return json(res, 200, {
      ok: true,
      data: { journal: { capability: "journal", native_baseline: true, active_provider: "native", providers: [] } },
      endpoints: [{ id: "API-005-journal-list", method: "GET", path: "/api/journal", capability: "journal", kind: "read", gate: "none", auth: "authenticated", note: null }],
    });
  }
  if (method === "GET" && p === "/api/vault/status") {
    return json(res, 200, { ok: true, data: { locked: vaultLocked, encrypted: true } });
  }
  if (method === "GET" && p === "/api/vault/names") {
    if (vaultLocked) return json(res, 409, { detail: "vault is locked" });
    return json(res, 200, { ok: true, data: { names: [...SECRETS.keys()] } });
  }
  if (method === "POST" && p === "/api/vault/unlock") {
    const body = await readBody(req);
    if (!body?.passphrase) return json(res, 400, { detail: "passphrase required" });
    vaultLocked = false;
    return json(res, 200, { ok: true, status: "unlocked", data: null, warnings: [] });
  }
  if (method === "POST" && p === "/api/vault/lock") {
    vaultLocked = true;
    return json(res, 200, { ok: true, data: { locked: true } });
  }
  if (method === "POST" && p === "/api/vault/set") {
    if (vaultLocked) return json(res, 409, { detail: "vault is locked" });
    const body = await readBody(req);
    if (!body?.name || body.value === undefined) {
      return json(res, 400, { detail: "name and value required" });
    }
    SECRETS.set(body.name, String(body.value));
    return json(res, 200, { ok: true, data: { name: body.name } });
  }
  // Per-name routes (api.py vault_get / vault_delete). Fixture
  // fiction only: values live in this process, never persisted.
  if (p.startsWith("/api/vault/") && p !== "/api/vault/set") {
    const name = decodeURIComponent(p.slice("/api/vault/".length));
    if (method === "GET") {
      if (vaultLocked) return json(res, 409, { detail: "vault is locked" });
      if (!SECRETS.has(name)) return notFound(res);
      return json(res, 200, { ok: true, data: { name, value: SECRETS.get(name) } });
    }
    if (method === "DELETE") {
      if (vaultLocked) return json(res, 409, { detail: "vault is locked" });
      SECRETS.delete(name);
      return json(res, 200, { ok: true, data: { deleted: name } });
    }
  }
  if (method === "OPTIONS" && (p.startsWith("/api") || p === "/healthz")) {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    });
    return res.end();
  }

  notFound(res);
});

if (process.env.E2E_API_WORLD) {
  // A private world for one worker, on an ephemeral port the router picks.
  server.listen(0, "127.0.0.1", () => {
    process.send?.({ port: server.address().port });
  });
} else {
  startRouter();
}

// ─── The router: one fixture world per Playwright worker ─────────────
function startRouter() {
  const worlds = new Map(); // worker id -> Promise<port>
  const children = [];
  const worldFor = (id) => {
    if (!worlds.has(id)) {
      worlds.set(
        id,
        new Promise((resolve, reject) => {
          const child = fork(fileURLToPath(import.meta.url), [], {
            env: { ...process.env, E2E_API_WORLD: id },
            stdio: ["ignore", "ignore", "inherit", "ipc"],
          });
          children.push(child);
          child.once("message", (m) => resolve(m.port));
          child.once("exit", (code) => reject(new Error(`world ${id} exited (${code})`)));
        }),
      );
    }
    return worlds.get(id);
  };
  const router = http.createServer(async (req, res) => {
    const raw = String(req.headers["x-e2e-worker"] ?? "default");
    const id = /^[a-z0-9-]{1,32}$/i.test(raw) ? raw : "default";
    let port;
    try {
      port = await worldFor(id);
    } catch (err) {
      res.writeHead(502, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    const upstream = http.request(
      { host: "127.0.0.1", port, method: req.method, path: req.url, headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (err) => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    });
    req.pipe(upstream);
  });
  const stop = () => {
    for (const c of children) c.kill();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  router.listen(PORT, "127.0.0.1", () => {
    console.log(`pw-station e2e mock API router on http://127.0.0.1:${PORT} (one world per worker)`);
  });
}
