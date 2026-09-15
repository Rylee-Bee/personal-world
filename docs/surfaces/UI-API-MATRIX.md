# UI → API MATRIX — Project Worlds

| UI ID | Action/Data | API ID | Read/Write | Current state |
|---|---|---|---|---|
| UI-001 Today | world summary + greeting | API-003 | Read | ACTIVE |
| UI-001 Today | daily digest | API-004 (GET) | Read | ACTIVE |
| UI-001 Today | run daily loop | API-004 (POST) | Write | ACTIVE |
| UI-001 Today | reminders | API-067 (GET) | Read | ACTIVE |
| UI-001 Today | apps launcher | API-066 (GET) | Read | ACTIVE |
| UI-002 Interests | discovery status/sources/interests/discover | API-049..052 | Read (POSTs not step-up gated) | ACTIVE |
| UI-003 Media | status/library/recent/activity/search | API-053..057 | Read | ACTIVE |
| UI-004 Projects | estate status | API-079 | Read | ACTIVE |
| UI-004 Projects | repo status/history | API-033, API-034 | Read | ACTIVE |
| UI-004 Projects | approved repo refresh | API-035 | Write (step-up) | ACTIVE (propose→approve→act workflow #1) |
| UI-004 Projects | GitHub enrichment | API-036 | Read | ACTIVE |
| UI-005 Lab | lab state/health/deploy/secrets/resources/settings | API-037..044 | Read | ACTIVE |
| UI-005 Lab | native lab inventory/health/settings/resources | API-045..048 | Read | ACTIVE |
| UI-005 Lab | reconciler status/diff/propose | API-058..060 | Read | ACTIVE |
| UI-005 Lab | ingress rollups | API-078 | Read | ACTIVE |
| UI-006 Journal | list events | API-005 | Read | ACTIVE |
| UI-006 Journal | write note | API-006 | Write | ACTIVE |
| UI-006 Journal | supersede (correction) | API-007 | Write (step-up) | ACTIVE |
| UI-006 Journal | correction chain | API-008 | Read | ACTIVE |
| UI-006 Journal | audit view | API-009 | Read | ACTIVE |
| UI-007 Vault | status/names | API-061, API-063 (GET) | Read | ACTIVE |
| UI-007 Vault | unlock/lock | API-062 | Write (bearer only, not step-up) | ACTIVE |
| UI-007 Vault | set/delete | API-063 (set), API-064 (delete) | Write (bearer only, not step-up) | ACTIVE |
| UI-007 Vault | get value | API-064 | Read (loopback/private) | ACTIVE |
| UI-008 Chat | send message (+history, +route context) | API-010 | Read+model write (journal recommendation event) | ACTIVE |
| UI-008 Chat | providers list | API-011 | Read | ACTIVE |
| UI-008 Chat | correction draft (proposal) | API-007 (after human approval) | Write (step-up) | ACTIVE |
| UI-009 Settings | prefs get/put | API-030 | Read / Write (step-up) | ACTIVE |
| UI-009 Settings | prefs schema | API-031 | Read | ACTIVE |
| UI-009 Settings | sections get/put | API-032 | Read / Write (step-up) | ACTIVE |
| UI-009 Settings | apps get/put | API-066 | Read / Write (step-up) | ACTIVE |
| UI-009 Settings | provider probe | API-012 | Read (spends quota) | ACTIVE |
| UI-009 Settings | identity principal read/update | API-073, API-074 | Read / Write (step-up) | ACTIVE |
| UI-010 SetupWizard | setup status + bootstrap | API-001 (setup_needed), API-002 | Write (public, first-run) | ACTIVE |
| UI-011 Login | local token login | AUTH-009 (POST /api/auth/login) | Write (session) | ACTIVE |
| UI-011 Login | OIDC config | AUTH-009 (/api/auth/oidc/config) | Read | ACTIVE |
| UI-012 World | world summary/actors | API-003, API-014 | Read | ACTIVE |
| UI-012 World | intent/fact/policy quick actions | API-075, API-076 | Write (step-up) | ACTIVE |
| UI-014 SectionNav | section order/hidden | API-032 | Read / Write (step-up) | ACTIVE |
| UI-016 CompanionPresence | companion art | ASSET-001 | Read | ACTIVE |
| UI-021 ConnectionsPanel | schemas/overview/config | API-017..020 | Read | ACTIVE |
| UI-021 ConnectionsPanel | save/delete connection, native config | API-021, API-022 | Write (step-up in-handler) | ACTIVE |
| UI-021 ConnectionsPanel | test/validate | API-023, API-024 | Read (probe) | ACTIVE |
| UI-018 StepUpPrompt | step-up grant | AUTH-009 (POST /api/auth/step-up) | Write | PARTIAL (grant exists; require_step_up does not consume it) |
| UI-005 Lab (settings) | prefs/sections (Settings owns) | API-030/032 | — | Settings screen only |
| UI-003 Media | themes (none) | API-065 | — | API exists; no UI consumer found |
| (no UI) | theme packs | API-065 | Read | PARTIAL (no frontend consumer found) |
| (no UI) | identity admin users | API-068..070 | Read/Write | ACTIVE API, no visible UI surface |
| (no UI) | updates apply/rollback | CLI-018 | Write | deliberately CLI-only |
| (no UI) | backup | API-028, CLI-008 | Read | ACTIVE (external encryption expected) |

Note: the SPA also boot-fetches API-030 (prefs) on every non-auth
route before first paint (App.tsx bootstrap).