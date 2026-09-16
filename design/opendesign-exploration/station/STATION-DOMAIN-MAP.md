# STATION → REAL DOMAIN MAP
## Internal orientation, 2026-09-16 (repo truth, SHA 5c46d7e)

Walked the repo per the technical orientation. This maps each Station
neighborhood to the REAL capabilities behind it, so the design layers
atmosphere over existing domain truth instead of inventing a second app.

## 1. Current frontend routes/screens
`/` Today · `/world` · `/journal` · `/chat` · `/interests` · `/media`
`/projects` · `/lab` · `/vault` · `/settings` · `/setup` · `/login`
Shell: `WorkshopShell` wraps non-auth routes; `SectionNav` (API-032) orders sections.

## 2. Shared shell/navigation
`WorkshopShell` + `SectionNav` + `WorldIdentity` + `CompanionPresence`.
New model (owner-approved): Today·World·Journal·Chat + **Places** → Station hub → neighborhoods.

## 3. Current Station/Places implementation
None in product yet. Only the OpenDesign exploration
(`design/opendesign-exploration/`) + this `station/` prototype. Deliberately divergent exploration; not yet canonical.

## 4. Real APIs available per neighborhood
| Neighborhood | Real endpoints | Honest states to build |
|---|---|---|
| **Promenade** (Today/orientation) | API-003 status, API-004 daily, API-067 reminders, `/api/proposals*` | attention / quiet / proposals-awaiting |
| **Observatory** (interests/patterns) | API-049..052 discovery status/sources/interests/discover, API-016 memory search | empty / not-configured / partial |
| **Workshop** (projects + making) | API-079 estate, API-033/034 sc status/history, API-035 approved refresh, API-036 GH enrichment | healthy / dirty / diverged / unknown |
| **Engine Room** (infra/providers) | API-017..024 connections, API-037..048 lab, API-058..060 reconciler, API-078 ingress | not_configured / unavailable / stale |
| **Lighthouse** (outward signals) | API-052 discover, API-053..057 media, API-029 updates | empty / unavailable / fresh |
| **Library** (journal + memory) | API-005..009 journal, API-016 memory, API-054 library | empty / private / rich |
| **Medbay** (quiet/care) | API-030 prefs, API-067 reminders (quiet), companion prefs | low-demand mode |
| **Helm** (world/overview) | API-003 status, API-014 actors, API-075/076 intent/fact/policy | oriented / unknown |

## 5. Reusable components
`StatusChip` (status vocabulary), `Disclosure`, `Dialog`, `Drawer`, `LiveRegion`,
`StepUpPrompt`, `CompanionSlot`, `CompanionPopover`, `lib/capability-health.ts`,
`lib/project-status.ts`, `lib/observation-age.ts`, `lib/projection.ts` (WIP).

## 6. Existing design experiments
`design/opendesign-exploration/*` (rounds 1-5, Station), `design/handoff/v4/*`
(character art, MIMO handoff), `frontend/prototype.html`, `frontend/preview.html`,
`TodayScreen.v2.tsx`, `DiscoveryItem/Surface`, `Greeting` (WIP, untracked).

## 7. Missing wiring (opportunities, not deletions)
- **API-065 theme packs**: ACTIVE API, NO frontend consumer → this is the
  "expandable for others and their own themes" hook.
- **`/api/proposals*`** (brain-write review): ACTIVE API + durable store, no UI →
  "what needs my approval" belongs on the Promenade.
- **API-068..070 identity admin**: ACTIVE, no UI.
- **API-065 themes** + **WORLD-007 packs** + **API-032 sections** = the theming/
  extensibility surface.

## 8. Accessibility constraints
`docs/accessibility/ACCESSIBILITY_CONTRACT.md`: 44px targets, luminance-only rank,
reduced-motion default, dark default, keyboard, SR labels, non-color-only status,
200% reflow. Playwright axe with color-contrast ENABLED is the gate.

## 9. Tests covering the area
`frontend` vitest + Playwright (`frontend/e2e/`): screens, shell, headings,
tokens, motion-lint, no-fake-strings, axe. Backend pytest. `framework validate`.

## 10. Files I intend to change (design prototype only, not product yet)
`design/opendesign-exploration/station/*` — expand the world prototype.
NO product `frontend/src/**` changes until the direction is approved (Checkpoint 1).

---
*Repo truth before design assumptions. Domain truth before mock data.*
