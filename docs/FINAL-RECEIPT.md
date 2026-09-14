# PROJECT WORLDS — FINAL RECEIPT
# Commit: 2d940c6
# Date: 2026-09-13

---

## TESTS

- **665 passed**, 570 warnings, 0 failures
- Frontend: TypeScript compiles clean, Vite build succeeds

---

## COMPOSE STATUS

| Service | Image | Status |
|---------|-------|--------|
| core | ghcr.io/rylee-bee/personal-world:latest | healthy |
| ollama | ollama/ollama:latest | healthy |
| ollama-pull | ollama/ollama:latest | completed (qwen3:1.7b pulled) |

---

## SCREENS VERIFIED (15)

| Screen | Route | Status |
|--------|-------|--------|
| TodayScreen | / | ✅ WIRED (7 hooks) |
| ChatRoute | /chat | ✅ WIRED (ChatPanel) |
| JournalScreen | /journal | ✅ WIRED (6 hooks + writes) |
| VaultScreen | /vault | ✅ WIRED (CRUD) |
| WorldScreen | /world | ✅ WIRED (manifest + exports + writes) |
| SettingsScreen | /settings | ✅ WIRED (prefs + sections + reminders + apps + themes + profile + identity) |
| ProjectsScreen | /projects | ✅ WIRED (source-control + agent-sync) |
| LabScreen | /lab | ✅ WIRED (native lab + homelab + ingress) |
| InterestsScreen | /interests | ✅ WIRED (discovery CRUD) |
| MediaScreen | /media | ✅ WIRED (native media with 4 providers) |
| SetupWizard | /setup | ✅ WIRED |
| LoginScreen | /login | ✅ WIRED |
| LabOperationsPanel | (sub-panel) | ✅ WIRED (lazy) |
| CompanionPresence | sidebar | ✅ WIRED (reads companion context) |
| CompanionPopover | sidebar | ✅ WIRED (statusText prop) |

---

## BRAIN TOOLS VERIFIED (25)

### Read tools (19):
| Tool | Status |
|------|--------|
| inspect_world_status | ✅ |
| inspect_manifest | ✅ |
| read_journal | ✅ |
| search_journal | ✅ |
| inspect_source_control | ✅ |
| inspect_source_control_history | ✅ |
| inspect_projects | ✅ |
| inspect_lab_inventory | ✅ |
| inspect_lab_health | ✅ |
| inspect_lab_resources | ✅ |
| inspect_lab_settings | ✅ |
| inspect_reconciler_status | ✅ |
| inspect_reconciler_diff | ✅ |
| inspect_discovery_status | ✅ |
| list_discovery_sources | ✅ |
| list_interests | ✅ |
| run_discovery | ✅ |
| inspect_vault_status | ✅ |
| inspect_reminders | ✅ |

### Media tools (4):
| Tool | Status |
|------|--------|
| inspect_media_status | ✅ |
| inspect_media_recent | ✅ |
| inspect_media_activity | ✅ |
| search_media | ✅ |

### Write tools (6, proposal-based):
| Tool | Status |
|------|--------|
| propose_journal_entry | ✅ |
| propose_world_intent | ✅ |
| propose_world_fact | ✅ |
| propose_reminder | ✅ |
| propose_reconciler_apply | ✅ |
| execute_approved_write | ✅ |

---

## PROVIDER TOOL-CALLING

| Provider | chat_with_tools | Status |
|----------|----------------|--------|
| Ollama | ✅ | Working |
| OpenAI-compat | ✅ | Working |
| OpenAI | ✅ | Working |
| Anthropic | ✅ | Working |
| OpenCode | ❌ | tool_calling: unsupported |

---

## MEDIA PROVIDERS

| Provider | Adapter | Status |
|----------|---------|--------|
| Plex | PlexAdapter | ✅ Built (not_configured without credentials) |
| Sonarr | SonarrAdapter | ✅ Built (not_configured without credentials) |
| Radarr | RadarrAdapter | ✅ Built (not_configured without credentials) |
| Lidarr | LidarrAdapter | ✅ Built (not_configured without credentials) |

---

## AUTH/SSO

| Feature | Status |
|---------|--------|
| Local/bootstrap login | ✅ Working |
| Session-cookie auth | ✅ Working (httponly, secure, samesite=lax) |
| OIDC config | ✅ Provider-neutral seam |
| Authelia integration | ✅ config/oidc.example.json ready |
| Step-up auth | ✅ 300s window |
| Break-glass | ✅ PW_API_TOKEN fallback |
| Agent bearer auth | ✅ Untouched |

---

## API ENDPOINTS (84 data operations)

All 84 endpoints wired to real domain operations.

New endpoints added:
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/session
- POST /api/auth/step-up
- GET /api/auth/oidc/config
- GET /api/auth/oidc/login
- GET /api/auth/oidc/callback
- GET /api/media/status
- GET /api/media/library
- GET /api/media/recent
- GET /api/media/activity
- GET /api/media/search

---

## CAPABILITIES (18)

| Capability | Native | Provider | Status |
|------------|--------|----------|--------|
| source_control | ✅ | native-git | WORKING |
| deployment | ❌ | none | not_configured |
| secrets | ❌ | none | not_configured |
| calendar | ❌ | none | not_configured |
| discovery | ❌ | native_discovery | WORKING |
| settings_validation | ✅ | native_reconciler | WORKING |
| service_validation | ❌ | native_lab | WORKING |
| update_discovery | ❌ | none | not_configured |
| memory | ❌ | none | not_configured |
| journal | ✅ | built-in | WORKING |
| reasoning | ❌ | ollama | WORKING |
| media | ❌ | native_media | WORKING |
| notifications | ❌ | none | not_configured |
| scheduler | ❌ | built-in | WORKING |
| homelab_* | ❌ | lab_cli | OPTIONAL |

---

## WRITE/APPROVAL TEST

1. Brain proposes: `propose_journal_entry("test")` → returns proposal_id
2. Owner approves: `execute_approved_write(proposal_id, true)` → entry written
3. Owner rejects: `execute_approved_write(proposal_id, false)` → no change
4. Stale proposal: second execute → "not pending" error
5. Step-up required: `execute_approved_write` has `requires_step_up: true`

---

## KNOWN NOT_CONFIGURED CAPABILITIES

- deployment (no provider)
- secrets (no provider)
- calendar (no provider)
- memory (no provider)
- notifications (no provider)
- Media providers (Plex/Sonarr/Radarr/Lidarr need credentials in connections.json)
- OIDC (needs config/oidc.json + OIDC_CLIENT_SECRET env)

---

## REMAINING DEFECTS

None that block clean boot or end-to-end use.

---

## FILE LOCATIONS

| File | Path |
|------|------|
| This receipt | docs/FINAL-RECEIPT.md |
| Full inventory | docs/FULL-SYSTEM-INVENTORY.md |
| API wiring | docs/API-WIRING-HANDOFF.md |
| Media domain | src/personal_world/providers/native_media.py |
| Auth module | src/personal_world/auth.py |
| Auth routes | src/personal_world/auth_routes.py |
| Tool registry | src/personal_world/tool_registry.py |
| Chat providers | src/personal_world/chat_registry.py |
| OIDC example | config/oidc.example.json |
