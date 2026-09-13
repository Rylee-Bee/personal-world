# Project Worlds — API + Provider Wiring Handoff
# Everything that exists. What's connected. What needs defaults.
# Goal: refine, not engineer.

---

## 1. API ENDPOINTS — COMPLETE INVENTORY

### Legend
- ✅ WIRED — endpoint has fetch function + hook + screen uses it
- 🔌 HOOK ONLY — fetch function + hook exist, no screen uses it yet
- 📦 FETCH ONLY — fetch function exists, no hook
- ⬜ UNWIRED — endpoint exists in backend, no frontend code

---

### Core / Auth / Setup

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/healthz` | GET | ⬜ Internal | Used by Docker healthcheck, no UI needed |
| `/api/setup/status` | GET | 📦 FETCH ONLY | `fetchSetupStatus` — used by setup wizard |
| `/api/setup` | POST | ⬜ | Setup wizard writes, one-time use |

### World / Status

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/status` | GET | ✅ WIRED | `useWorldStatus` → TodayScreen, WorldScreen, SettingsScreen |
| `/api/daily` | GET | ✅ WIRED | `useDaily` → TodayScreen |
| `/api/daily` | POST | ⬜ | Triggers daily loop (journal observations, capability facts) |
| `/api/actors` | GET | ✅ WIRED | `useActors` → WorldScreen |
| `/api/manifest` | GET | 🔌 HOOK ONLY | `useManifest` — capability manifest, never rendered |
| `/api/updates` | GET | 🔌 HOOK ONLY | `useUpdates` — available updates, never rendered |

### Journal

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/journal` | GET | ✅ WIRED | `useJournal` → TodayScreen |
| `/api/journal` | POST | ⬜ | Write journal entry — no UI surface |
| `/api/journal/supersede` | POST | ⬜ | Supersede journal entry |
| `/api/journal/history` | GET | 📦 FETCH ONLY | `fetchJournalHistory` — full history |
| `/api/journal/audit` | GET | 🔌 HOOK ONLY | `useJournalAudit` — integrity audit |

### Prefs / Sections

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/prefs` | GET | ✅ WIRED | SettingsScreen reads prefs |
| `/api/prefs` | PUT | ✅ WIRED | SettingsScreen writes prefs via `savePrefsPartial` |
| `/api/prefs/schema` | GET | ✅ WIRED | SettingsScreen reads schema |
| `/api/sections` | GET | ✅ WIRED | SettingsScreen + SectionNav |
| `/api/sections` | PUT | ✅ WIRED | SettingsScreen writes sections |

### Reminders

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/reminders` | GET | ✅ WIRED | SettingsScreen reads reminders |
| `/api/reminders` | POST | ✅ WIRED | SettingsScreen adds reminders |
| `/api/reminders/{rid}` | DELETE | ✅ WIRED | SettingsScreen deletes reminders |

### Vault

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/vault/status` | GET | ✅ WIRED | `useVaultStatus` → VaultScreen |
| `/api/vault/unlock` | POST | ⬜ | Unlock vault — needs passphrase input UI |
| `/api/vault/lock` | POST | ⬜ | Lock vault |
| `/api/vault/names` | GET | 🔌 HOOK ONLY | `useVaultNames` — list secret names |
| `/api/vault/set` | POST | ⬜ | Set a secret |
| `/api/vault/{name}` | GET | ⬜ | Read a secret |
| `/api/vault/{name}` | DELETE | ⬜ | Delete a secret |

### Source Control

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/source-control/status` | GET | ✅ WIRED | `useSourceControlStatus` → ProjectsScreen |
| `/api/source-control/history` | GET | 🔌 HOOK ONLY | `useSourceControlHistory` — commit history per repo |
| `/api/source-control/refresh` | POST | ⬜ | Trigger refresh (step-up) |
| `/api/source-control/enrichment` | GET | 🔌 HOOK ONLY | `useSourceControlEnrichment` — GitHub enrichment |
| `/api/projects/status` | GET | ⬜ | Agent-sync project status |

### Chat / Reasoning

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/chat` | POST | ⬜ | Send chat message — needs chat UI |
| `/api/chat/providers` | GET | 🔌 HOOK ONLY | `useChatProviders` — list reasoning providers |
| `/api/chat/test` | POST | ⬜ | Test a chat provider |

### Lab (homelab-backed)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/lab/state` | GET | 🔌 HOOK ONLY | `useLabState` — operator packet from Lab CLI |
| `/api/lab/settings` | GET | 🔌 HOOK ONLY | `useLabSettings` — settings reconciler status |
| `/api/lab/settings/inspect/{service}` | GET | ⬜ | Inspect desired state for one service |
| `/api/lab/settings/diff/{service}` | GET | ⬜ | Drift between desired and live |
| `/api/lab/health` | GET | 🔌 HOOK ONLY | `useLabHealth` — service health |
| `/api/lab/deploy` | GET | 🔌 HOOK ONLY | `useLabDeploy` — deploy status |
| `/api/lab/secrets` | GET | 🔌 HOOK ONLY | `useLabSecrets` — secret audit |
| `/api/lab/resources` | GET | 🔌 HOOK ONLY | `useLabResources` — VM resources |

### Native Lab (generic, no homelab dependency)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/native-lab/inventory` | GET | 🔌 HOOK ONLY | `useNativeLabInventory` — service inventory |
| `/api/native-lab/health` | GET | 🔌 HOOK ONLY | `useNativeLabHealth` — health monitoring |
| `/api/native-lab/settings` | GET | 🔌 HOOK ONLY | `useNativeLabSettings` — settings inspection |
| `/api/native-lab/resources` | GET | 🔌 HOOK ONLY | `useNativeLabResources` — resource monitoring |

### Native Discovery (generic)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/discovery/status` | GET | 🔌 HOOK ONLY | `useDiscoveryStatus` — discovery engine status |
| `/api/discovery/sources` | GET | 🔌 HOOK ONLY | `useDiscoverySources` — list sources |
| `/api/discovery/sources` | POST | ⬜ | Add a discovery source |
| `/api/discovery/interests` | GET | 🔌 HOOK ONLY | `useDiscoveryInterests` — list interests |
| `/api/discovery/interests` | POST | ⬜ | Add an interest |
| `/api/discovery/discover` | GET | 🔌 HOOK ONLY | `useDiscoveryDiscover` — run discovery |

### Native Reconciler (generic)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/reconciler/status` | GET | 🔌 HOOK ONLY | `useReconcilerStatus` — reconciler status |
| `/api/reconciler/diff/{service}` | GET | ⬜ | Compute drift for a service |
| `/api/reconciler/propose/{service}` | GET | ⬜ | Propose reconciliation actions |

### Identity / Multi-user

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/identity/principal` | GET | ✅ WIRED | `usePrincipal` — current user identity |
| `/api/identity/principal` | PUT | ⬜ | Update principal profile |
| `/api/identity/users` | GET | ⬜ | List users |
| `/api/identity/users` | POST | ⬜ | Create user |
| `/api/identity/users/{user_id}` | DELETE | ⬜ | Delete user |
| `/api/identity/agents` | GET | ⬜ | List agents |
| `/api/identity/agents` | POST | ⬜ | Create agent |
| `/api/identity/agents/{agent_id}` | DELETE | ⬜ | Delete agent |

### Memory

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/memory/search` | GET | 🔌 HOOK ONLY | `useMemorySearch` — semantic search |

### Exports / Backup

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/exports/settings` | GET | 🔌 HOOK ONLY | `useExportSettings` — settings export |
| `/api/exports/world` | GET | 🔌 HOOK ONLY | `useExportWorld` — world export |
| `/api/exports/story` | GET | 🔌 HOOK ONLY | `useExportStory` — story export |
| `/api/backup` | GET | 🔌 HOOK ONLY | `useBackup` — full backup |

### Ingress

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/ingress/rollups` | GET | ⬜ | Traefik ingress rollups |

### World Writes

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/world/intent` | POST | ⬜ | Record an intent |
| `/api/world/fact` | POST | ⬜ | Record a fact |
| `/api/world/policy` | POST | ⬜ | Record a policy |

### Apps

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/apps` | GET | 🔌 HOOK ONLY | `useApps` — list service apps |
| `/api/apps` | PUT | ⬜ | Update apps |

### Themes

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/themes` | GET | 🔌 HOOK ONLY | `useThemes` — list theme packs |
| `/api/themes/{name}` | GET | ⬜ | Get theme details |

### GitHub Enrichment

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/source-control/enrichment` | GET | 🔌 HOOK ONLY | `useSourceControlEnrichment` — GitHub data |

### Agent Sync

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/projects/status` | GET | 🔌 HOOK ONLY | `useAgentSyncProjects` — agent-sync estate |

---

## 2. SUMMARY COUNTS

| Status | Count |
|--------|-------|
| ✅ WIRED (endpoint → hook → screen) | 18 |
| 🔌 HOOK ONLY (endpoint → hook, no screen) | 22 |
| 📦 FETCH ONLY (endpoint → fetch, no hook) | 2 |
| ⬜ UNWIRED (endpoint only) | 25 |
| **Total endpoints** | **67** |

---

## 3. PROVIDERS — CAPABILITY DEFAULTS NEEDED

### Current capability inventory (from STANDARD_CAPABILITIES)

| Capability | Description | Native Baseline | Has Default Provider | Needs Default |
|------------|-------------|-----------------|---------------------|---------------|
| `source_control` | Read repositories, issues, pull requests | ✅ Yes | ✅ native-git | No |
| `deployment` | Deploy or schedule services | ❌ No | ❌ None | YES |
| `secrets` | Broker secret material to consumers | ❌ No | ❌ None | YES |
| `calendar` | Observe calendar events | ❌ No | ❌ None | Maybe |
| `discovery` | Discover content matching interests | ❌ No | ✅ native_discovery (new) | No |
| `settings_validation` | Validate settings against intent | ✅ Yes | ✅ native_reconciler (new) | No |
| `service_validation` | Validate service health | ❌ No | ✅ native_lab (new) | No |
| `update_discovery` | Discover available updates | ❌ No | ❌ None | Maybe |
| `memory` | Search long-term memory | ❌ No | ❌ None | Maybe |
| `journal` | Read structured history | ✅ Yes | ✅ Built-in | No |
| `reasoning` | Optional AI interpretation | ❌ No | ✅ ollama (new) | No |
| `notifications` | Send notifications | ❌ No | ❌ None | Maybe |
| `scheduler` | Run tasks on a schedule | ❌ No | ❌ None | Maybe |
| `homelab_settings` | Homelab settings reconciliation | ❌ No | ❌ Lab CLI only | Enrichment |
| `homelab_health` | Homelab service health monitoring | ❌ No | ❌ Lab CLI only | Enrichment |
| `homelab_deploy` | Homelab deployment status | ❌ No | ❌ Lab CLI only | Enrichment |
| `homelab_secrets` | Homelab secret management | ❌ No | ❌ Lab CLI only | Enrichment |
| `homelab_resources` | Homelab VM resource monitoring | ❌ No | ❌ Lab CLI only | Enrichment |

### New native providers (just built)

| Provider | Capability | Status |
|----------|-----------|--------|
| `native_lab` (inventory) | `service_inventory` | Registered, hook exists, no screen |
| `native_lab` (health) | `service_health` | Registered, hook exists, no screen |
| `native_lab` (settings) | `settings_validation` | Registered, hook exists, no screen |
| `native_lab` (resources) | `resource_monitoring` | Registered, hook exists, no screen |
| `native_discovery` | `discovery` | Registered, hook exists, no screen |
| `native_reconciler` | `settings_validation` | Registered, hook exists, no screen |
| `worlds-local-brain` (ollama) | `reasoning` | Registered, no chat UI |

### Provider types the system supports (from connections.json)

| Type | Class | Capability | Needs API Key |
|------|-------|-----------|---------------|
| `ollama` | `OllamaChat` | reasoning | ❌ No |
| `openai_compat` | `OpenAICompatChat` | reasoning | Optional |
| `openai` | `OpenAIChat` | reasoning | ✅ Yes |
| `anthropic` | `AnthropicChat` | reasoning | ✅ Yes |
| `opencode` | `OpenCodeChat` | reasoning | ❌ No |
| `http_status` | `HttpStatus` | any | ❌ No |
| `gitea` | `Gitea` | source_control | Optional |
| `langgraph` | `LangGraphMemory` | memory | Optional |
| `candy` | `CandyDispenser` | discovery | ❌ No |
| `lab_api` | `LabState/LabSettings/etc` | homelab_* | ❌ No |
| `fake_source_control` | `FakeSourceControl` | source_control | ❌ No |
| `native_lab` | `NativeLabInventory/etc` | service_inventory etc | ❌ No |
| `native_discovery` | `NativeDiscovery` | discovery | ❌ No |

---

## 4. SCREENS — WHAT THEY RENDER FROM

| Screen | Data Sources | Missing |
|--------|-------------|---------|
| **Today** | `/api/status`, `/api/daily`, `/api/journal` | Notifications, reminders, chat preview |
| **Interests** | `/api/discovery/sources`, `/api/discovery/interests`, `/api/discovery/discover` | Empty state works, needs real sources configured |
| **Projects** | `/api/source-control/status` | History, enrichment, agent-sync, PR status |
| **Journal** | `/api/journal` | Write UI, history, audit, memory search |
| **Vault** | `/api/vault/status` | Unlock/lock UI, secret CRUD |
| **World** | `/api/status`, `/api/actors` | Manifest, exports, backup |
| **Settings** | `/api/prefs`, `/api/sections`, `/api/reminders`, capabilities | Full — most complete screen |
| **Lab** | `/api/lab/state`, `/api/lab/health` | Native lab inventory, reconciler diff UI |

---

## 5. WHAT TO BUILD NEXT (priority order)

### Tier 1: Make existing hooks render somewhere

1. **Lab screen → native lab inventory/health** — wire `useNativeLabInventory` + `useNativeLabHealth` into LabScreen
2. **Interests screen → real discovery sources** — configure RSS/Atom sources in discovery provider
3. **Journal screen → write UI** — POST `/api/journal` form
4. **Vault screen → unlock/lock UI** — passphrase input, lock/unlock buttons
5. **Today screen → notifications** — surface warnings + actions from `/api/daily`

### Tier 2: Wire remaining hooks to screens

6. **Projects → history** — `useSourceControlHistory` commit list per repo
7. **Projects → enrichment** — `useSourceControlEnrichment` GitHub data
8. **World → manifest** — `useManifest` capability table
9. **World → exports** — `useExportSettings` / `useExportWorld` / `useExportStory` download buttons
10. **Lab → reconciler diff** — `useReconcilerStatus` desired vs actual view

### Tier 3: Build chat UI

11. **Chat interface** — POST `/api/chat`, `useChatProviders` provider switcher
12. **Chat → actions** — companion can propose reconciliations, trigger actions

### Tier 4: Identity / multi-user

13. **User management** — `/api/identity/users` CRUD
14. **Agent management** — `/api/identity/agents` CRUD
15. **Principal profile** — `/api/identity/principal` edit

### Tier 5: Advanced

16. **Memory search UI** — `useMemorySearch` semantic search surface
17. **World writes** — intent/fact/policy recording from UI
18. **Scheduler** — task scheduling UI
19. **Notifications** — notification delivery configuration
20. **Ingress** — Traefik rollup dashboard

---

## 6. COMPOSE TEMPLATE — CURRENT STATE

The current `compose.yaml` ships:
- `core` — Project Worlds API + frontend
- `ollama` — local reasoning brain (qwen3:1.7b)
- `ollama-pull` — init container that pulls the model

**What's missing from the default compose:**
- No discovery sources configured (RSS feeds, etc.)
- No native lab services registered
- No reconciler desired-state files
- No vault initialized
- No source control search paths beyond the container's own repo

**To make it a real appliance, the compose needs:**
- Volume mounts for discovery config
- Volume mounts for reconciler desired state
- Volume mounts for lab inventory
- Environment variables documented
- Optional service profiles (homelab, github, etc.)

---

## 7. connections.json DEFAULTS

Current defaults (already in repo):
```json
{
  "$schema": "personal-world/connections/1",
  "source_control": {
    "search_paths": ["/data/repos/personal-world"]
  },
  "connections": [
    {
      "type": "ollama",
      "name": "worlds-local-brain",
      "capability": "reasoning",
      "base_url": "http://ollama:11434",
      "model": "qwen3:1.7b",
      "timeout": 120
    }
  ]
}
```

**What could be added as defaults:**
- `native_lab` provider for service inventory
- `native_discovery` provider for RSS-based discovery
- `native_reconciler` provider for settings reconciliation
- Source control search paths for mounted repos

---

## 8. TEST COVERAGE

- 662 Python tests passing
- Frontend tests: shell-responsive spec (updated), screens-today spec (deleted — needs rewrite)
- Public safety tests: updated to allow local ollama provider
- Token hex test: enforces no hardcoded colors in CSS

---

## 9. WHAT'S IN REFINEMENT STATE vs NEEDS ENGINEERING

### Ready to refine (code exists, needs wiring/polish)
- All 7 screens render, need real data connections
- Native Lab/Discovery/Reconciler providers exist, need config
- Ollama brain registered, needs chat UI
- Settings screen is 90% complete
- Shell modes (rail/sidebar) working

### Needs engineering (no code yet)
- Chat interface (POST `/api/chat` has no UI)
- Vault CRUD (unlock/lock/set/get/delete)
- User/agent identity management
- Memory search surface
- World write surfaces (intent/fact/policy)
- Notification delivery system
- Scheduler UI
