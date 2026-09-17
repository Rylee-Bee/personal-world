# Alpha status — Project Worlds

*Where the alpha actually stands, for the owner. The canonical gap list
lives in [`ROADMAP.md`](../ROADMAP.md) — this page is a status snapshot,
not a second truth. Snapshot verified 2026-09-17 against the code; it
will age, the roadmap should not.*

---

## Where we are

The backend is daily-use capable and the Station is the product UI.

- **Backend — solid.** Auth/session/step-up, multi-user per-principal
  data, journal (+search), reminders, preferences, proposals
  write-safety (propose → approve → act), fail-closed vault, Git
  reads, one chat loop with provider-neutral adapters, generic OIDC,
  first-run setup wizard, `/api/manifest` (the Lego box).
- **Deployment — working.** Single compose appliance: core service +
  bundled Ollama + a one-shot `ollama-pull` (no API key needed);
  container daily-use proven.
- **Frontend — Station, honestly partial.** The Station
  (`/station/`, same-origin from `design/opendesign-exploration/station/`)
  is the product UI; `/login` and `/setup` are server-rendered. The
  real-data layer wires needs-you, journal, preferences, projects
  (source-control reads), and interests; chat send posts to the real
  /api/chat route (no streaming yet); the browser-local journal is
  labelled "Notes on this device" and remaining specimen blocks are
  clearly labelled and stay honest until real data exists.

## Honest gaps today

These are the verified ones; see [`ROADMAP.md`](../ROADMAP.md) for
detail and grounding:

- Chat streaming (the send path is real; responses still arrive whole).
- Remaining specimen panels (media cards, map region detail) need real
  data or honest empty states.
- Step-up authentication is a trust window, not re-authentication.
- Theme packs: registry exists, full front-of-house integration
  remains.
- Ingress rollups: implemented, not operationally verified.

## Needs you

Right now: nothing is blocked on you. Owner-scoped calls that sit
ahead of further work are collected in [`ROADMAP.md`](../ROADMAP.md)
— nothing there is guessable from repository truth alone.

---

*If your head hurts: skip this page and read
[`ROADMAP.md`](../ROADMAP.md) "Now" instead.*
