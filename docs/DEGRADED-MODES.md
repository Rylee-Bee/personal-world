# Worlds — Degraded Modes Matrix (G-degrade)

> **Status:** Reference · **Verified:** 2026-09-26 · **Canonical for:** what the product says and does when a part of it is missing, unreachable, refused, or unauthenticated · **Read this if:** you are changing a fail-closed path or a degraded label and need the contract it must keep.

**In short:** a tested matrix of the G-degrade states — brain absent, provider down, a refused error envelope, setup incomplete, auth unconfigured, non-loopback dev bypass, provider-less memory, and the storage/backup boundary. Each row lists what still serves, the exact label it shows, and the test that proves it. Every tested cell is honest: `unavailable` / `stale` / `not_configured` stated plainly, never a fake success, never a dead button wearing a live one.

**Kind:** tested state matrix — what the product says and does when a part of it
is missing, unreachable, refused, or unauthenticated.
**Contract it serves:** the product-language contract at `docs/PRODUCT-LANGUAGE.md`
(owner-approved 2026-09-21), principle 3 — *warm in tone, exact in facts*: degraded
must be **honest**. Never a fake success, never a dead button wearing a live one,
`unavailable` / `stale` / `not_configured` stated plainly, never blame.
**Enforcement:** [`../tests/test_degraded_modes.py`](../tests/test_degraded_modes.py)
(32 tests, ids `a1`–`h4` cited below, as of 2026-09-26). Where an earlier test already
pins the same cell, its id is cited too.
**Verified green on:** branch `lane/degraded-matrix` @ `58f3b5e` (2026-09-21 run). Re-run
`uv run --extra test pytest -q tests/test_degraded_modes.py` for today's result.
**No defects found** — every tested cell behaves to contract. Two *label observations*
are recorded at the bottom; neither breaks the honesty floor.

The machinery behind most rows is the fail-closed provider registry
([`../src/personal_world/providers/registry.py`](../src/personal_world/providers/registry.py)):
a missing or unhealthy provider yields a labeled `Result`, never an exception and
never a silent lie.

## How to read a row

| Column | Meaning |
| --- | --- |
| Still works | Deterministic surfaces that keep serving, with the promise they carry |
| Says it plainly | What degrades, the exact label it shows, and the HTTP shape |
| Proven by | Test ids. `DM:` = `test_degraded_modes.py` (this file's companion); ids are `Class::method` abbreviations |

---

## (a) Brain absent — the shipped default

PW defaults to **no model configured**. This is a vacancy, not a failure, and the
digest treats it as one: no alert noise for empty slots.

| | |
| --- | --- |
| **Still works** | Everything deterministic: `/api/status`, `/api/daily`, journal, sections, settings, vault, backup boundary |
| **Says it plainly** | `/api/chat` → HTTP 200 `{ok:false, status:"not_configured"}` with a "no chat provider configured" warning · `/api/chat/test` → same label · `/api/chat/providers` → `active: null` · capability grid: `reasoning: not_configured` · the Bridge's attention line **excludes** vacancies (a gap is not an alarm) |
| **Proven by** | `DM:TestBrainAbsent::a1–a5`; pre-existing: `test_chat.py::TestChatEndpoint::test_no_provider_is_not_configured` |

## (b) Brain configured, provider unreachable

A real connection exists (e.g. Ollama) but the endpoint is down. Tested with a
genuinely **closed loopback port** — a real `ConnectionRefusedError`, not a
monkeypatched network lie.

| | |
| --- | --- |
| **Still works** | Core boots and stays 200: `/healthz`, `/api/status`, `/api/daily` (digest itself is `ok:true`) |
| **Says it plainly** | Capability grid: `reasoning: unavailable` · the Bridge's attention line reads `reasoning: unavailable` (the home screen is the **Bridge**, area id `overview`; see Observations for where it is surfaced visually) · `/api/chat` → 200 `{ok:false, status:"unavailable"}`, **no fabricated reply** · `/api/chat/providers` lists the provider with `ok:false` and its real status |
| **Proven by** | `DM:TestBrainUnreachable::b1–b4` |
| **Not simulated** | A *hung* (non-refusing) endpoint: same except-path after `CHAT_TIMEOUT_SECONDS`, but a timeout-lengthened test is deliberately not added (flaky-value, slow) — **UNTESTABLE here — timing-dependent; refusal path proven, hang path shares it** |

## (c) Provider alive, returns an `ok:false` error envelope

Reachable provider that refuses (bad/expired key, quota, provider-side 4xx).

| | |
| --- | --- |
| **Still works** | The request completes as a 200 labeled envelope — the person sees the *provider's own* label, unchanged |
| **Says it plainly** | `/api/chat` passes the provider's status through verbatim (`unauthorized`, warning `api key not valid`) — no laundering into a generic "something went wrong", no rewrite to healthy, no reply field invented. Control cell proves a *succeeding* provider's reply does flow, so absence-of-reply in the failing case is honesty, not broken plumbing |
| **Proven by** | `DM:TestProviderErrorEnvelope::c1–c2` |

## (d) Setup incomplete — no `data/setup-complete` marker

| | |
| --- | --- |
| **Still works** | `/healthz` (`setup_needed: true`), `/api/setup/status` (`complete: false`), `GET /` → 303 → `/setup`, the server-rendered wizard at `/setup` (200 HTML) — the deterministic first-run door is always open during first run |
| **Says it plainly** | Setup state and auth state are **separate axes**: an incomplete setup never opens the API (protected routes still 503 without a token), and completing the marker flips `setup_needed` with nothing else changed |
| **Proven by** | `DM:TestSetupIncomplete::d1–d4`; pre-existing: `test_setup_wizard.py`, `test_api_hardening.py::COR-12` (`FORCE_SETUP=1` re-open), `test_boot_token.py`, `test_critical_batch.py` (init writes the marker) |

## (e) Auth unconfigured — no token anywhere

No `PW_API_TOKEN` in env, no `data/.env` store, nothing to authenticate with.

| | |
| --- | --- |
| **Still works** | `/healthz` (200, `auth_configured: false` — the degraded state is *visible*, not hidden), `/setup` wizard, `/api/setup/status`, login page routes |
| **Says it plainly** | Every protected route → **503 `auth not configured`** (fail closed). A bearer presented against an empty credential store also 503s — the gate never falls through toward a pass. This is the deliberate 503-vs-401 split: 503 = "this instance has no door yet", 401 = "your key didn't work" (no blame, just fact) |
| **Proven by** | `DM:TestAuthUnconfigured::e1–e4`; pre-existing: `test_dev_auth_bypass.py::TestBypassBehavior::test_off_no_token_fails_closed` |

## (f) `PW_DEV_AUTH_BYPASS` set, request from a non-loopback peer

The bypass is an explicit, loopback-only development exception. From anywhere else
it behaves as if it were not set. Tested end-to-end by rewriting the **ASGI peer
field** (the exact value `_is_true_loopback` reads) to a TEST-NET-3 synthetic address
— transport-level simulation, no faked predicates.

| | |
| --- | --- |
| **Still works** | Normal auth from the LAN peer: correct bearer → 200; the app itself stays fully up; `/healthz` **still reports `dev_bypass: true`** from any vantage (the risky flag is visible, never hidden from observers) |
| **Says it plainly** | LAN peer + no credential → 503 (bypass not granted) · LAN peer + wrong/missing bearer → 401 · LAN peer + correct bearer + write → 403 `write requires step-up auth` (bypass grants no step-up, and on loopback auth and step-up remain distinct concepts) · `POST /api/setup` (the credential-minting endpoint) → 403 from a LAN peer **even with the bypass on** — a remote peer can never take over a fresh instance |
| **Proven by** | `DM:TestBypassNonLoopback::f1–f5`; pre-existing unit floor: `test_dev_auth_bypass.py::TestLoopbackDetection`, `test_step_up_authority.py::TestStepUpSeam` |

## (g) Journal / Memory capability without a provider

**The repo truth, verified here:** Memory is *not* an AI feature. The core always
registers a **native FTS5 baseline** (`native-memory`, SQLite over the journal) —
see `../src/personal_world/app.py` (`build_registry`). So "no provider" for memory
means *no external/enrichment provider*, and the honest answer is: **nothing
degrades**. The row that *is* degraded — `reasoning: not_configured` — stays plainly
labeled next to it. "Chat is a shortcut, never the only door" is enforced by
construction here.

| | |
| --- | --- |
| **Still works** | Journal: note → read-back → audit, all with zero providers · Memory search: a journaled note is findable via the native baseline with no external connection of any kind · Grid shows the honest mix: `memory: healthy` (native) beside `reasoning: not_configured` (vacant) |
| **Says it plainly** | Nothing in this state claims AI it doesn't have; semantic enrichment (e.g. a `langgraph` memory provider) simply isn't active until configured |
| **Proven by** | `DM:TestJournalMemoryWithoutProvider::g1–g3`; pre-existing: `test_journal_supersede.py`, `test_framework.py` (native baseline invariants) |

## (h) Storage / backup boundary

| Cell | State | What happens | Proven by |
| --- | --- | --- | --- |
| h-1 | Vault, no `cryptography` extra | Unlock **refuses**: `{ok:false, status:"unavailable"}`; `/api/vault/status` reports `locked:true, encrypted:false` — never claims encryption it lacks | `DM:h1`; pre-existing `test_vault_fail_closed.py` (same module-flag idiom — the flag is what a crypto-less install actually has, not a fabricated state) |
| h-2 | Worlds backup without crypto | `POST /api/worlds/backup` → **503** with the "unavailable without real encryption" warning; no archive, no partial write | `DM:h2`; pre-existing `test_worlds_backup.py::test_missing_crypto_extra_fails_closed`, `::test_real_app_refuses_and_serves_backup` |
| h-3 | Transcript store unwritable (real `OSError`, path held by a directory) | The chat **reply still arrives** (200, `ok:true`) — a transcript write failure never swallows the visible answer — and the failure is **logged**, not silenced | `DM:h3, h3b` (promise stated in `api.py`: "Best-effort: a transcript write failure must never swallow the visible reply") |
| h-4 | Search index corrupt (garbage bytes at `data/memory.fts5.db`) | Memory search → 200 `{ok:false, status:"unavailable"}`; capability grid says `unavailable` too; **the canonical journal is untouched** and still reads back — "the index is disposable, the files are truth" | `DM:h4` |
| h-5 | Literal disk-full (ENOSPC) mid-write | **UNTESTABLE here — reason:** needs a real full filesystem (tmpfs mount requires privileges this lane lacks); faking it by monkeypatching `write` would be exactly the kind of lie this matrix exists to prevent. The honest adjacent conditions (unwritable path, corrupt file) are covered by h-3/h-4 | — |
| h-6 | Canonical write against read-only storage (`chmod 0555` data dir; probed live, 2026-09-21: `POST /api/daily` / `POST /api/journal` raise `PermissionError` out of the handler — a live server turns that into a 500) | **UNPROMISED here:** no contract promises a labeled state for a failed canonical write. Verified honesty holds anyway: the write fails **loudly** (never a fake `ok:true`), while read-only surfaces keep serving — `GET /api/daily` returns 200 and its warnings include `memory: unavailable` because the index cannot be built | probe evidence; a green test is deliberately NOT pinned here — it would fossilize the 500 as contract (see Observations 3) |

---

## Observations (not defects — recorded honestly, nothing papered over)

1. **`/api/chat/providers` `active` names a down provider.** During state (b) the
   top-level `active` is the configured provider's name even while its per-provider
   `ok:false, status:"unavailable"` sits in the same payload. `active` documents
   "which provider is wired" (`Registry.provider_for` marks it degraded), not "which
   provider answers" — and the truth rides in the same response, so no cell fakes
   health. A clearer rename (`wired` vs `ready`) is product-language polish, filed
   here rather than silently asserted-away.
2. **`NativeMemoryProvider.health()` returns a constant `True`
   (../src/personal_world/providers/native_memory.py).** Selection therefore always
   prefers the native slot — but every *status* surface derives from `observe()` /
   `search()` results, so a broken index still reads `unavailable` to users (proven
   by `DM:h4`). No user-visible lie; a deeper health probe would be a tightening,
   not a fix.
3. **Failed canonical writes 500 (h-6).** Verified against a read-only data dir:
   `POST /api/daily` and `POST /api/journal` raise `PermissionError` through the
   handler (500 on a live server). The honesty floor holds — no fake success, reads
   unaffected — but a plain "storage unavailable" envelope would match the product
   language better. Out of scope for this lane; flagged for the council.

## Fixtures and idioms this suite reuses (no new harness)

- `create_app(tmp_path, tmp_path)` + `TestClient` + strict env `monkeypatch` —
  `test_dev_auth_bypass.py::_client`
- `unittest`-grade module flag patching for *real install variants* (no crypto) —
  `test_vault_fail_closed.py`
- Provider registration through the app's own registry seam
  (`build_registry` patch) — `test_chat.py::TestChatEndpoint`
- Synthetic TEST-NET peers with `pw-safety: synthetic` markers —
  `test_step_up_authority.py`
- Loopback step-up + bypass precedence expectations —
  `test_dev_auth_bypass.py::TestBypassBehavior`

**Related docs:** `ARCHITECTURE.md` (registry + fail-closed core) ·
`OPERATIONS.md` (token/store recovery) · `WORLDS-BACKUP.md` (h-2 boundary) ·
`IDENTITY-BOUNDARY.md` (f-row auth/step-up separation) · `PROVIDERS.md` (enrichment
vs native baseline, row g).
