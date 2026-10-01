# Rebuild contracts C1–C5

> **Status:** Accepted 2026-10-01 by orchestrator · **Date:** 2026-10-01 · **Canonical for:** the five contracts the front-door rebuild lanes build against · **Read this if:** you are working on any `rebuild/*` lane. Authority: [ADR-0008](../adr/0008-front-door.md). Baseline: `.project/PROPOSAL-FRONT-DOOR-2026-10-01.md`.

**Stack (orchestrator decision):** Python 3 + FastAPI + uv; React + Vite + TypeScript + react-query. Package `personal_world`, env prefix `PW_`, image name and `/healthz` `commit` are kept. On `rebuild/front-door`, obsolete modules are deleted, not adapted.

## C1 Config files (canonical truth)

YAML, `schema_version: 1` in every file, at `$PW_CONFIG_DIR/worlds/{providers,requests/<provider>,cards,boards,actions}/<id>.yaml`. Ids match `^[a-z0-9][a-z0-9-]{0,62}$`; request ids are `<provider>.<name>`.

- **Provider:** `id, name, kind (http|room0|reference), base_url, path_prefix`; `auth {type: none|bearer|header|basic, header_name?, secret_ref (env:NAME|vault:NAME)}`; `network {lan: false}`, `tls_verify` (default true), `timeout_s` (default 5, max 15), `max_bytes` (default 2 MiB, hard max 8 MiB).
- **Request:** `id, provider, method, path` (relative; no scheme or host; no `..`), `query {}`, `headers {}` (allow-list; never Authorization or Cookie), `body` (json|null); `effect: auto|read|write` (auto: GET/HEAD read, else write; a config may raise read→write, never lower write→read without an explicit reviewed `known_safe: true`); `ttl_s, timeout_s`, `assertions [{status: 200} | {path, exists|is_list|equals}]`.
- **Card:** `id, title, icon, group (life|machine), request` (or `requests []` to aggregate), `view (stat|list|table|status|meter|link|markdown)`, `meaning {concept, short, full}`; `fields [{path, label, format (number|percent|bytes|duration|relative_time|text), unit}]` where `path` is a JSONPath subset (`$.a.b`, `[*]`, `[n]`; no filters, no scripts); `meter {type: segments|bars|progress|marks|dots|day|shelf, …}`; `status {path, healthy: [], needs_attention: [], else: unknown}`.
- **Board:** `id, title, home: bool, items [{card, size: S|M|L, hidden: false}]`.
- **Action:** `id, request, name, access (read|write), approval (never|always; missing → always; write → always unless owner-set), scope (string), idempotency (required|optional|none), exposed (bool, default false)`. `version` = sha256 of the canonicalized resolved action + request + provider destination. It is computed, never written.

**Store behaviour:** validate refs and schema; atomic write (tmp + fsync + rename); per-file etag, 409 on mismatch; an invalid edit is rejected and the last valid config stays active; reload never executes anything; a change to a provider destination or credential ref, a request or an action invalidates pending authorizations whose version no longer matches; UI writes produce the same files (round-trip test: load→save→load equal).

## C2 Result and freshness envelope

One per card fetch. The API returns only mapped data.

```
{card_id, source_state, freshness, observed_at, fetched_at, last_good_at,
 values:{field:{text, raw?}}, meter:{…, text_equivalent},
 meaning:{short, full},
 evidence:{request_id, method, path, status_code?, duration_ms?, error_class?, note?}}
```

- `source_state` (Play-Nice words only): `healthy | needs_attention | degraded | unavailable | stale | unknown | not_configured`. `freshness`: `current | stale`.
- Availability and freshness are separate. Unavailable keeps last-good values marked stale, with `last_good_at`.
- Missing is not 0. An empty list is not unavailable.
- Evidence is redacted: no secrets, no upstream body beyond 2 KB, never the Authorization header.
- `error_class`: `timeout | connection | http_4xx | http_5xx | malformed | redirect_refused | too_large | confinement_denied | auth_failed`.

### C2.1 Values and states (accepted 2026-10-01)

- **Field key** = slug(label): lowercase, non-alphanumerics become `-`, trimmed; a collision gets `-2`, `-3`.
- A **missing** value is `{"text":"unknown"}` with no `raw` key (never 0). An **empty list** is `{"text":"none","raw":[]}` and is healthy, not unavailable.
- **Failure mapping** (`error_class` → `source_state`): `timeout`, `connection`, `http_5xx`, `redirect_refused`, `too_large`, `confinement_denied` → `unavailable`; `auth_failed` (HTTP 401/403) → `needs_attention`; `http_4xx`, `malformed` → `degraded`. Missing config → `not_configured`.
- After a failure the card keeps last-good values with `freshness: stale` and `last_good_at`; with none, every field reads `unknown`.
- **Config PUT** needs the real etag in `If-Match` (update) or `If-None-Match: *` (create). `If-Match: *` is refused with 428.

## C3 Action, authority and receipt lifecycle

SQLite at `$PW_DATA_DIR/worlds.db`, WAL, `BEGIN IMMEDIATE`.

- **`authorizations`:** `id, action_id, action_version, caller (principal id), destination (provider id + base_url hash), params_hash, created_at, expires_at (default 10 min), state (pending|approved|denied|expired|invalidated|consumed), authority (worlds_owner | project_home:<approval id>), approved_at, approved_by, step_up_at`.
- **`executions`:** `id, authorization_id UNIQUE, intent_at, dispatch_started_at, finished_at, state (INTENT|DISPATCHING|SUCCEEDED|FAILED|UNKNOWN), status_code, evidence_redacted, idempotency_key`.
- **Consume is one transaction:** `UPDATE authorizations SET state='consumed' WHERE id=? AND state='approved' AND expires_at>now AND action_version=current_version`; `INSERT executions(state=INTENT)`; commit. Then `UPDATE → DISPATCHING` (commit), then exactly one network attempt (client retries off), then SUCCEEDED, FAILED or UNKNOWN.
- FAILED only with evidence of non-execution (for example a 4xx validation reply). Timeout, connection reset after send, a 5xx of unclear effect, or a crash is UNKNOWN.
- Startup recovery: INTENT or DISPATCHING becomes UNKNOWN and is never re-sent.
- A retry needs a NEW authorization, with a warning that the earlier one may have run.
- **Callers:** agents see only exposed actions within their scope; a token is never approval. Approval for Project Home-governed operations goes through Project Home's `/room/actions` approve and is recorded in `authority`. For other services the owner confirms in Worlds with step-up.
- Connect test/run of a write uses this exact path. Save, preview, mapping and import never dispatch.
- **Receipt** = an execution row joined with its authorization (caller, action_id, version, authority, timestamps, state, redacted evidence).

## C4 Memory persistence boundary

- **Durable:** `worlds.db` tables `kept, later, records (sensitivity: normal|locked), history (append-only events)`, each with provenance (`owner | external_ref | suggestion`), `created_at`, `updated_at`.
- **Find** is an FTS5 index over them, queried with escaped, parameterized terms; never raw MATCH syntax.
- Locked records need step-up and are excluded from agent answers and previews unless step-up is active.
- Agent access is named, narrow, governed read actions only (for example `memory.later.count`); no generic search tool.
- **Export:** NDJSON per table. **Backup:** SQLite online backup API to a dated file.
- **Durability classes:** config files (canonical; back up with the config volume); `worlds.db` (durable: Memory, receipts, authorizations); cache dir `$PW_DATA_DIR/cache` (disposable; deleting it loses only last-good data).
- Owner decision 2026-10-01: start fresh. No import of the old journal, `world.json`, stickers or search index; no migration code.

## C5 Card accessibility props (UI ⇄ API)

Every rendered card or row exposes: accessible name; state word plus shape (● healthy, ▲ needs attention, ■ unavailable, ◌ stale, ○ unknown, ◇ not configured, ◆ degraded); value text with unit; meter `text_equivalent`; freshness text; a link to detail. Targets ≥44px; labels ≥13px; body 16px; no colour-only state; static unless `prefers-reduced-motion: no-preference`.

## C6 Home read API

Orchestrator decisions, 2026-10-01. Values come only from the per-card C2 envelope (`GET /api/cards/{id}`).

- `GET /api/boards/home` → `{id, title, items:[{card, size S|M|L, hidden, title, icon, group life|machine, view, fields:[{key, label, format, unit}], meter_type|null}]}`. The display definition is derived from the C1 card. No request ids, paths, provider URLs or JSONPaths in the payload. The primary value is `fields[0]`. `needs_you` is not a board item field.
- `GET /api/needs-you` → `[{id, text, source, created_at, action:{kind: open|approve, href?|authorization_id?}}]`. `text` is a terse imperative ("Approve Hive Works plan"). Fed by pending Project Home approvals (room/0) and pending Worlds authorizations. Needs you is never inferred from `source_state`.
- Grouping, by C2 envelope:
  - **Needs a look:** `source_state` in {unavailable, degraded, stale, needs_attention, unknown} or `freshness: stale`. Worst first: unavailable, degraded, stale, needs_attention, unknown.
  - **Your life:** healthy + `group: life`. **Quietly working:** healthy + `group: machine` (folds to one line in Calm density).
  - **not_configured:** not a row on Home. It shows as ◇ in the whole-world strip only, linking to Connect.
  - An empty Needs a look shows "Nothing needs a look. Everything is answering." Groups never reorder.
- **Pick up (reserved):** omit the section entirely when there is no data. The future source is `GET /api/pickup`, backed by Memory Later and History (L-memory).
