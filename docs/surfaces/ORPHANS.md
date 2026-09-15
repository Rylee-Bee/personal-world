# ORPHAN / SUPERSEDED INDEX — Project Worlds

| ID | Surface | State | Evidence | Confidence |
|---|---|---|---|---|
| CHAT-002 (A) | chat.py::build_chat_provider | ORPHAN | app.py imports build_chat_provider from chat_registry, not chat.py; grep shows no caller of chat.py's builder | HIGH |
| PROV-031 | ChatProviderRegistry class (chat_registry.py) | ORPHAN | Defined; no import/caller found (chat flows use Registry.provider_for) | HIGH |
| PROV-029 | SopsBroker | ORPHAN | Implemented pipe-to-consumer path; no registration or caller | HIGH |
| PROV-030 | SOPSVaultAdapter | ORPHAN | Read-through adapter; set/delete unsupported; no caller found | HIGH |
| STORE-020 | data/executions.json (ExecutionViewer/ExecutionStore) | ORPHAN | Wired in build_registry but no route/tool caller found | HIGH |
| ASSET-007a | ThemePack default paths /static/companions/*.svg | ORPHAN | theme_pack.py defaults use /static/companions; api.py serves /companions/{name}.svg only (no /static route) | HIGH |
| AUTH-008 | Session step-up grant (POST /api/auth/step-up → step_up_until) | PARTIAL | Grant implemented + persisted, but require_step_up never reads sessions | HIGH |
| AUTH-002/003 | Session cookie + OIDC as API gate | PARTIAL | Sessions created and stored; require_auth is bearer-only | HIGH |
| API-065 | Themes API | PARTIAL | GET /api/themes(/{name}) implemented; no frontend consumer found | MEDIUM |
| STORE-013 | data/theme-packs runtime integration | PARTIAL | Registry reads manifests; ARCHITECTURE.md says "not full frontend pack integration" | HIGH |
| TOOL-027 | propose_reminder executor | STUB | Executor returns "executed" without touching reminders.json | HIGH |
| TOOL-028 | propose_reconciler_apply executor | STUB | Executor notes "Actual provider apply requires adapter" | HIGH |
| TOOL-013 | inspect_reconciler_diff | PARTIAL | Returns desired state only; "Observed state not available for diff" | HIGH |
| TOOL-029 | execute_approved_write approval semantics | PARTIAL | Approval is a caller-supplied boolean; proposals in-memory per-process | HIGH |
| PROV-011 | NativeDeploymentProvider (compose/systemd adapters) | PARTIAL | Registered; status/observe only; no live deploy caller | MEDIUM |
| PROV-009 (send) | NativeNotificationsProvider.send (webhook/ntfy) | PARTIAL | Provider registered and observed; no current send() caller in api/cli/tools | MEDIUM |
| CAP-013 | scheduler capability (no provider registered) | PARTIAL | Capability defined; Scheduler used directly, not via capability | HIGH |
| UI-023 | SPA missing-frontend 503 page | INTERNAL | Deliberate honest-missing state (T15 cutover, no legacy fallback) | HIGH |
| PROV-024 | CandyDispenser | INTERNAL | Demo/reference provider behind explicit connections type=candy | HIGH |
| PROV-003 | FakeSourceControl | INTERNAL | Substitution-proof machinery for tests | HIGH |
| PROV-028 | FakeUpdateProvider | INTERNAL | Update state-machine reference for tests | HIGH |
| API-080 | source-control rollups direct connections.json read | SUPERSEDED-adjacent | ARCHITECTURE.md records the override-merge divergence; endpoint still reads tracked file directly | MEDIUM |
| NAV-002 | /setup-wizard alias | ACTIVE (alias) | Intentional legacy alias Navigate→/setup (T15 cutover) | HIGH |
| DOC-008 | design/handoff package | HIDDEN | Archived spec; never edit (AGENT_CONTRACTS rule) | HIGH |
| ASSET-005 | Mermaid master .lottie | HIDDEN | Deliberate artwork, byte-identical by decision; not runtime-served | HIGH |
| PROV-002 | Gitea forge adapter | PARTIAL | Retained as substitution-proof machinery; not a supported live provider (ARCHITECTURE.md) | HIGH |
| CHAT-005 (copies) | OpenAICompatChat in both chat.py and chat_registry.py | PARTIAL | Two class copies; registry copy live | HIGH |
| TOOL-019 | inspect_reminders direct file read | PARTIAL | Duplicates Scheduler read path via PW_DATA_DIR env | HIGH |
| A11Y-003 | Design preference schema (motion beyond reduced) | PARTIAL | Schema richer than prefs.py accepts; default agrees (ARCHITECTURE.md recorded boundary) | HIGH |
| API-012 | /api/chat/test | ACTIVE | Was unauthenticated per older docs; current code has require_auth | HIGH (code) |

Not listed as dead merely for lacking a frontend consumer: identity
admin APIs (API-068..074), themes API (API-065), updates API
(API-029), memory search (API-016) — these have API consumers,
CLI parity, tests, or are deliberate headless surfaces.