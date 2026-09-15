# MAJOR CALL CHAINS — Project Worlds

Compact chains from the registry. IDs resolve in
MASTER-SURFACE-REGISTRY.md.

## First launch

```text
CLI-010 init → LIFE-006 init_world → STORE-001 world.json + STORE-002 journal.ndjson (zero-provider)
→ browser /setup (UI-010, NAV-003 AuthRoutes)
→ API-002 GET /api/setup/status (STORE-009 marker)
→ API-002 POST /api/setup → writes STORE-010 data/.env (PW_API_TOKEN) + STORE-009 + optional STORE-003 vault init
→ restart → AUTH-006 boot-token reconciliation (STORE-010 wins over compose env)
→ SPA (UI-013 via API-001 setup_needed → redirect)
```

## Browser auth (current reality)

```text
UI-011 login (token) → AUTH-009 POST /api/auth/login → AUTH-002 login_local (PW_API_TOKEN compare) → STORE-004 session + pw_session cookie
   (OIDC variant: AUTH-003 /api/auth/oidc/login → INT-006 exchange → login_oidc → STORE-004)
→ BUT: protected API calls still require AUTH-001 bearer (pw_token in localStorage)
→ require_auth → IDENT-003 resolve_principal (single: bootstrap primary; multi: STORE-005 hashed tokens)
→ request.state.principal → protected route
```

## World read

```text
UI-001/UI-012 → API-003 GET /api/status (AUTH-001)
→ LIFE-009 _state(): LIFE-002 build_registry (STORE-014 + STORE-015 merge → DOMAIN-007)
→ DOMAIN-001 World (STORE-001 load_world)
→ world.summary() + registry.status_map() + registry.actors()
```

## World brain write

```text
UI-008 Chat → API-010 POST /api/chat (AUTH-001)
→ CHAT-009/010 context (STORE-001, JOURNAL-002, CHAT-015 templates, CHAT-010 UI block)
→ CHAT-011 tool schemas → TOOL-000 loop (CHAT-004..008 provider)
→ TOOL-024/025/026 propose_* → in-memory _proposals (tool_registry)
→ TOOL-029 execute_approved_write (approved flag from loop)
→ JOURNAL-001 journal.record(source=brain-tool) / WORLD-001/002 world mutation (MutationDenied gate)
→ STORE-001 is NOT saved by the tool executor in this path (facts/intents mutate the in-memory per-request World)
```

## Journal

```text
UI-006 note → API-006 (AUTH-001 + person) → JOURNAL-001 record → STORE-002 journal.ndjson
→ LIFE-008 NativeMemoryProvider.index_journal → STORE-012 memory.fts5.db (derived)
→ API-016 search (derived) | TOOL-004 search (direct journal.search)
UI-006 correction → UI approval → API-007 supersede (step-up) → JOURNAL-003 supersede (append-only link) → STORE-002
CLI-007/API-027 → JOURNAL-004 StoryRenderer; API-009 → JOURNAL-005 AuditRenderer
```

## Project status

```text
UI-004 Projects → API-079 GET /api/projects/status (AUTH-001)
→ PROV-026 AgentSyncProjectSensor → INT-001 agent-sync subprocess (`agent-sync status --all --format json`)
→ normalized play-nice/repo-status-v1 records + freshness
→ UI
(git layer: UI-004 → API-033/034 → PROV-001 NativeGit → INT-005 git subprocess → repos)
(approved act: UI-004 → API-035 refresh (step-up) → repository_status → JOURNAL-001 PROVIDER_ACTION)
(remote facts: UI-004 → API-036 → PROV-004 GitHubEnrichment → INT-002 gh CLI)
```

## Reminder

```text
UI/API write → API-067 POST/PATCH/DELETE (step-up) → LIFE-004 Scheduler.add/toggle/remove → STORE-006 reminders.json
read → API-067 GET → Scheduler.list_reminders (instance)
parallel read → TOOL-019 inspect_reminders → direct STORE-006 file read (env PW_DATA_DIR)  [DUPLICATES row]
fire → LIFE-004 scheduler thread check_and_fire → JOURNAL-001 observation
```

## Chat

```text
UI-008 ChatRoute/ChatPanel → API-010 POST /api/chat (AUTH-001)
→ context: CHAT-009 build_world_context (+ CHAT-015 TemplateRegistry surface instructions + CHAT-010 UI context)
→ provider: DOMAIN-007 provider_for("reasoning") → CHAT-004..008
→ tools: TOOL-000 schemas; loop executes read tools via tool_registry handlers
→ reply: CHAT-013 extract_proposal (journal correction proposal validated vs JOURNAL-002)
→ JOURNAL-001 recommendation event (source=chat)
```

## Backup

```text
CLI-008 backup [--apply] / API-028 GET /api/backup (AUTH-001)
→ export.backup_payload(DOMAIN-001 world, JOURNAL-002 journal)
→ includes: serialized world + journal (incl. private state)
→ excludes: STORE-003 vault.enc, STORE-005 users, STORE-004 sessions, STORE-006 reminders, STORE-007 apps,
   per-user trees, STORE-015 connections.local.json, STORE-013/018/019
→ external encryption expected (SOPS/age), not provided by the app
restore path: no full-instance restore exists; CLI-010 init + manual re-entry is the recovery floor
```

## Vault value read (exceptional workflow)

```text
UI-007 unlock → API-062 (bearer) → SECRET-001 Vault.unlock (SECRET-003 Fernet/PBKDF2, else base64 fallback)
→ API-064 GET /api/vault/{name} (bearer + AUTH-005 loopback/private check)
→ STORE-003 → value returned → JOURNAL-001 name-only audit entry
```

## Connection save

```text
UI-021 → API-021 PUT (AUTH-001 + in-handler require_step_up) → CONN-002 ConnectionManager
→ writes STORE-015 connections.local.json (tracked file never written)
→ next request rebuilds: LIFE-002 build_registry merges STORE-014 + STORE-015 → DOMAIN-006 provider slots
```