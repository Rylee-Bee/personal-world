# CONNECTIONS & PROVIDERS — FINAL RECEIPT
# Commit: 3156443
# Date: 2026-09-14

---

## TESTS

**723 passed, 0 failed, 0 warnings**

---

## WHAT SHIPPED

### Backend

| Component | File | Purpose |
|-----------|------|---------|
| Provider schemas | `provider_schemas.py` | 7 capabilities, 16 provider schemas with config fields |
| Connection manager | `connection_manager.py` | CRUD for `connections.local.json` (private config) |
| API endpoints | `api.py` | 6 new endpoints for connections |

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/connections/overview` | Capability overview with status, config state |
| GET | `/api/connections/schemas` | All provider schemas for UI forms |
| GET | `/api/connections/schema/{cap}` | Single capability schema |
| GET | `/api/connections/config` | Full merged config |
| POST | `/api/connections/config/{key}` | Save native provider config |
| GET | `/api/connections` | List all connections |
| PUT | `/api/connections` | Save/update a connection |
| DELETE | `/api/connections/{name}` | Delete a connection |
| POST | `/api/connections/test` | Test a connection without saving |
| POST | `/api/connections/validate` | Validate connection config |

### Connection Testing

| Adapter | Test method |
|---------|-------------|
| Plex | HTTP GET to server with token |
| Sonarr/Radarr/Lidarr | HTTP GET to /api/v3/system/status |
| ICS | HTTP HEAD to feed URL |
| ntfy | HTTP GET to /v1/health |
| Webhook | URL validation only |
| GitHub Release | GitHub API /releases/latest |
| Ollama | HTTP GET to /api/tags |
| OIDC | HTTP GET to .well-known/openid-configuration |
| Compose | File existence check |
| systemd | Service name validation |

### Frontend

| Component | File | Purpose |
|-----------|------|---------|
| ConnectionsPanel | `ConnectionsPanel.tsx` | Full-width panel at top of Settings |
| SettingsScreen | `SettingsScreen.tsx` | Brain panel with reasoning provider info |
| EmptyState | `EmptyState.tsx` | configLink prop for deep links |
| MediaScreen | `MediaScreen.tsx` | Connect Media button in empty state |

### Connections Panel

- Compact summary: "X ready, Y need setup"
- Needs-setup items: Media, Calendar, Notifications, Deployment, Updates, OIDC
- Connected items: Source control, Memory, Secrets, Discovery, Reasoning
- Schema-driven config forms (no bespoke React per provider)
- Test connection button with structured results
- Secrets stored via Vault references
- Provider selector for capabilities with multiple adapters

### Brain Panel

- Reasoning provider list with active indicator
- Status chips for each provider
- Template details in disclosure

### Empty-State Deep Links

- MediaScreen: "Connect Media" button → /settings
- EmptyState component supports configLink prop

---

## CAPABILITIES REPRESENTED

| Capability | Providers | Schema |
|------------|-----------|--------|
| Media | Plex, Sonarr, Radarr, Lidarr | ✅ |
| Calendar | ICS, CalDAV | ✅ |
| Notifications | Webhook, ntfy | ✅ |
| Deployment | Docker Compose, systemd, Lab CLI | ✅ |
| Updates | GitHub Release, Version URL | ✅ |
| Auth | OIDC | ✅ |
| Reasoning | Ollama, OpenAI-compat, OpenAI, Anthropic | ✅ |

---

## PRIVATE CONFIG PERSISTENCE

- Writes to `connections.local.json` (never tracked `connections.json`)
- Merges with tracked config (local appended, local overrides)
- Native config keys: calendar, notifications, updates, deployment
- Connection entries: type, name, capability, config fields

---

## HOT RELOAD

After saving a connection:
1. Config persisted to `connections.local.json`
2. Frontend refetches `/api/connections/overview`
3. Provider registry rebuilds on next request (stateless)
4. No restart required for routine setup

---

## REMAINING NOT_CONFIGURED (intentional)

These need external configuration via the new panel:
- media (no Plex/Sonarr/Radarr/Lidarr)
- calendar (no ICS/CalDAV sources)
- notifications (no targets)
- deployment (no targets)
- update_discovery (no sources)
- auth/OIDC (no config)

---

## GIT COMMITS

| SHA | Description |
|-----|-------------|
| 3156443 | Connections & Providers control panel |
| 59573a1 | Final receipt |
| 60f1a19 | Brain Template System |
| 3e203d8 | Native providers + execution viewer + zero warnings |

---

## FILE LOCATIONS

| File | Path |
|------|------|
| This receipt | docs/CONNECTIONS-RECEIPT.md |
| Provider schemas | src/personal_world/provider_schemas.py |
| Connection manager | src/personal_world/connection_manager.py |
| API endpoints | src/personal_world/api.py |
| Connections panel | frontend/src/screens/ConnectionsPanel.tsx |
| Settings screen | frontend/src/screens/SettingsScreen.tsx |
| EmptyState | frontend/src/shell/EmptyState.tsx |
| Tests | tests/test_connections.py |
