# AUTH MATRIX — Project Worlds

Legend: YES / NO / INDIRECT / N/A.

| Surface ID | None | Bearer | Session | OIDC | Step-up | Local/private bypass | Admin |
|---|---|---|---|---|---|---|---|
| API-001 GET /healthz | YES | NO | NO | NO | NO | N/A | NO |
| API-002 setup status/POST setup | YES (first-run only; 409 after marker) | NO | NO | NO | NO | N/A | NO |
| UI-010 SetupWizard | YES | NO | NO | NO | NO | N/A | NO |
| UI-011 LoginScreen | YES | NO (performs login) | NO (creates) | INDIRECT | NO | N/A | NO |
| AUTH-001 require_auth | NO | YES | NO (sessions never consulted) | NO (not wired to principal) | NO | NO | NO |
| AUTH-002 session cookie | NO | NO | YES | NO | NO | NO | NO |
| AUTH-003 OIDC | NO | INDIRECT (proves identity at callback) | YES (creates session) | YES | NO | NO | NO |
| AUTH-004 require_step_up | NO | YES | NO | NO | YES (header/loopback/private) | YES (loopback + private peers) | NO |
| AUTH-005 loopback/private elevation | NO | YES (combined) | NO | NO | INDIRECT | YES | NO |
| AUTH-006 boot-token reconciliation | NO | INDIRECT (env feeding) | NO | NO | NO | N/A | NO |
| AUTH-007 admin gate | NO | YES | NO | NO | INDIRECT (often combined) | NO | YES |
| API-003 /api/status | NO | YES | NO | NO | NO | NO | NO |
| API-004 /api/daily | NO | YES | NO | NO | NO | NO | NO |
| API-005..009 journal GET | NO | YES (+person) | NO | NO | NO | NO | NO |
| API-006 POST /api/journal | NO | YES (+person) | NO | NO | NO | NO | NO |
| API-007 supersede | NO | YES | NO | NO | YES | INDIRECT | NO |
| API-010..014 chat/tools/actors/manifest | NO | YES | NO | NO | NO | NO | NO |
| API-016 memory search | NO | YES | NO | NO | NO | NO | NO |
| API-017..020 connections reads | NO | YES | NO | NO | NO | NO | NO |
| API-021 connections writes | NO | YES | NO | NO | YES (in-handler) | INDIRECT | NO |
| API-022 native config save | NO | YES | NO | NO | YES (in-handler) | INDIRECT | NO |
| API-023/024 test/validate | NO | YES | NO | NO | NO | NO | NO |
| API-025..028 exports/backup | NO | YES | NO | NO | NO | NO | NO |
| API-029 updates read | NO | YES | NO | NO | NO | NO | NO |
| API-030 prefs GET | NO | YES (+person) | NO | NO | NO | NO | NO |
| API-030 prefs PUT | NO | YES | NO | NO | YES | INDIRECT | NO |
| API-032 sections GET/PUT | NO | YES (+person) | NO | NO | YES (PUT) | INDIRECT | NO |
| API-033/034/036 source-control reads | NO | YES | NO | NO | NO | NO | NO |
| API-035 refresh (propose→approve→act) | NO | YES | NO | NO | YES | INDIRECT | NO |
| API-037..048 lab surfaces | NO | YES | NO | NO | NO | NO | NO |
| API-053..057 media | NO | YES | NO | NO | NO | NO | NO |
| API-058..060 reconciler | NO | YES | NO | NO | NO | NO | NO |
| API-061..063 vault status/unlock/lock/names/set | NO | YES | NO | NO | NO (documented divergence — not step-up) | NO | NO |
| API-064 vault GET value | NO | YES | NO | NO | NO | YES (loopback OR private peer — doc text says loopback-only) | NO |
| API-066 apps GET/PUT | NO | YES | NO | NO | YES (PUT) | INDIRECT | NO |
| API-067 reminders GET/POST/PATCH/DELETE | NO | YES | NO | NO | YES (writes) | INDIRECT | NO |
| API-068..070 identity users | NO | YES | NO | NO | YES (writes) | INDIRECT | YES (all three) |
| API-071..072 identity agents | NO | YES (+ownership) | NO | NO | YES (writes) | INDIRECT | INDIRECT (admins see all) |
| API-073/074 principal | NO | YES (+person for PUT) | NO | NO | YES (PUT) | NO | NO |
| API-075..077 world writes | NO | YES | NO | NO | YES | INDIRECT | NO |
| API-078..079 ingress/projects | NO | YES | NO | NO | NO | NO | NO |
| AUTH-009 login/logout/session/step-up routes (`auth_routes.py`) | YES (login/logout/session) | NO | INDIRECT | INDIRECT (oidc subset) | YES (POST /api/auth/step-up) | NO | NO |

Key observations (describing reality, not recommending):

- `require_auth` is the actual API gate. It is bearer-only; the
  session-cookie store (AUTH-002) and OIDC (AUTH-003) run as a parallel
  native-auth path that currently terminates at session creation and
  never feeds `request.state.principal`.
- Step-up (AUTH-004) is an IP/header check layered on bearer, not a
  re-authentication; the session-based step-up grant (AUTH-008) exists
  but is not consulted by `require_step_up`.
- Vault value GET (API-064) accepts loopback OR Python-classified
  private addresses despite "loopback-only" error text (matches
  ARCHITECTURE.md's recorded boundary).
- Admin gate (AUTH-007) applies only to identity user/agent
  administration routes.