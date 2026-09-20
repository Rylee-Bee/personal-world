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
 */

import http from "node:http";

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
};

const SECTIONS = [
  { id: "today", label: "Today", icon: "navigation--today", order: 0, visible: true, pinned: true, kind: "core", configured: true, status: null },
  { id: "journal", label: "Journal & Memory", icon: "navigation--journal", order: 1, visible: true, pinned: false, kind: "core", configured: true, status: null },
  { id: "settings", label: "Settings", icon: "navigation--settings", order: 2, visible: true, pinned: true, kind: "core", configured: true, status: null },
];

let vaultLocked = true;

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
  if (method === "PUT" && p === "/api/prefs") {
    const body = await readBody(req);
    if (body === null) return json(res, 400, { detail: "body must be JSON" });
    return json(res, 200, ok("healthy", { ...PREFS, ...body }));
  }
  if (p === "/api/sections" && (method === "GET" || method === "PUT")) {
    return json(res, 200, ok("healthy", { schema: "sections.v1", sections: SECTIONS }));
  }
  if (method === "GET" && p === "/api/journal") {
    const n = Math.min(Math.max(Number(url.searchParams.get("n") ?? 20), 1), 500);
    return json(res, 200, { ok: true, data: CURRENT.slice(0, n) });
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
      data: { principal_id: "person:operator", auth_method: "instance-token", has_step_up: true },
    });
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
    return json(res, 200, { ok: true, data: { names: ["E2E_FIXTURE_TOKEN"] } });
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
    return json(res, 200, { ok: true, data: { name: body.name } });
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

server.listen(PORT, "127.0.0.1", () => {
  console.log(`pw-station e2e mock API listening on http://127.0.0.1:${PORT}`);
});
