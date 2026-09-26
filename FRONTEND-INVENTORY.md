# Worlds — Frontend Inventory

> **Status:** Current · **Verified:** 2026-09-26 · **Canonical for:** what the browser interface is and where each piece lives · **Read this if:** you are about to work on the UI and want the map before the code

**In short:** The interface is the React app in `ui/`, not the old Station. It is built into the Docker image and served same-origin at `/` by the backend. This page names the screens, the shell, the design language, the tests, and the commands you need.

---

## The one stack

There used to be two stacks (a server-rendered Station and a React rebuild) side
by side. There is one now. Since the **2026-09-22 flip**, `ui/` is the only
interface: built into the image, served at `/`, auth-gated (no setup-complete →
`/setup`; unauthenticated → `/login`). `/station*` and `/vnext*` redirect to `/`.
The vanilla Station and the old `frontend/` suite are deleted from the tree (git
history is the archive); the Station survives only as a **theme package**.

| Piece | What | Where |
|---|---|---|
| **The app** | React 19 + TypeScript + Vite + Tailwind v4 | `ui/` |
| **Generated code** | Tokens + typed API client | `ui/src/generated/` |
| **Design tokens (truth)** | Semantic tokens, per theme | `design/themes/*.json` → `ui/src/generated/tokens.{css,ts}` |
| **Design language export** | The framework-free "Worlds kit" | `ui/dist-kit/` |
| **Browser tests** | Vitest units + Playwright e2e + axe | `ui/src/test/`, `ui/e2e/` |

---

## Screens (`ui/src/screens/`)

| Screen | What it is |
|---|---|
| **Bridge** | The home screen (area id `overview`): the Keeper, the briefing, and the rooms as doorway cards; remembers where you were. `Overview.tsx` still exists but is **not rendered** |
| **Memory** | Journal and records |
| **Chat** | One companion voice, with tone registers |
| **Settings** | Preferences, themes, accessibility, connections; opens **Crew** |
| **Crew** | Your companions, per-room keepers, and doorway choices (also reachable from the Bridge) |
| **Interests** | Discovery — moving to Candy, but the code still lives in Worlds today (`src/personal_world/discovery/`) |

Projects and Systems are labelled placeholders; they have no screen yet.

**First Light** is the first-run setup wizard (crew on/off, companion choice), at
`/api/setup-wizard/*`.

---

## The shell (`ui/src/app/App.tsx`)

- **State-routed, not URL-routed.** There is no router; every destination
  activates through `setActiveArea`, so there are no links to URLs nothing serves.
- **Two-tier navigation.** The fixed landmarks (`Overview · Memory · Chat ·
  Settings`) render first, in a fixed order, always. Below them the person's own
  sections come from `GET /api/sections`.
- **Themes.** First run defaults to **starfield** (`DEFAULT_THEME` in
  `ui/src/app/prefs-dom.ts`); a device choice wins and survives reloads via
  `localStorage`. Themes: starfield (default), doorways, station, moss, ocean,
  plain.
- **Status.** Status readouts come from the live `/healthz` probe, never hardcoded,
  and are always stated in words.

### Components (`ui/src/components/`)

`WorldButton`, `WorldSignal`, `WorldDrawer`, `WorldAssistant`, `WorldAreaLink`,
`WorldKeeper`, `ResidentPresence`, `RoomsPanel`, plus `crew/` and `rooms/` helpers.

### Data layer (`ui/src/data/`)

Typed API client (`api.ts`), React Query hooks (`hooks.ts`), section/area
derivation (`types.ts`), and the draft-sync helper (`draft-sync.ts`).

---

## Design language

- **Tokens.** `design/themes/*.json` are the source; the generator
  (`ui/scripts/generate-tokens.mjs`) writes `ui/src/generated/`. **Never hand-edit
  `ui/src/generated/`** — run the generator. Drift gate:
  `npm run tokens:check`.
- **Minimum text size.** Every theme meets it: body ≥ 16px, labels ≥ 13px.
- **Accessibility floor.** 44px targets, status always in words, visible focus,
  no sideways scroll at 390px, no motion by default.
- **Worlds kit** (`ui/dist-kit/`, kit.json version `0.1.0+<content hash>`): a
  framework-free export of the design language — `tokens.css` (all themes),
  `base.css` (`wk-` components, tokens only), fonts, `preview.html`. Vendored
  today by Studio, Project Home, and Candy. **Never hand-edit a vendored copy;
  re-stamp it.**

---

## Tests and gates

| Gate | Command (`cd ui`) |
|---|---|
| Unit tests (vitest) | `npx vitest run` |
| End-to-end + axe | `npm run test:e2e` |
| Type check | `npx tsc -b` |
| Lint | `npm run lint` |
| Token drift | `npm run tokens:check` |
| Kit build / drift / e2e | `npm run kit:build`, `kit:check`, `kit:test:e2e` |

The e2e suite runs against the real hub UI (`npm run preview`) and a seeded
fixture API (`ui/scripts/e2e-api.mjs`). Counts are deliberately not quoted here —
run the gate rather than trust a number.

---

## How to run it

```bash
cd ui
npm install          # first time only
npm run dev          # dev server; proxies /api to a local backend
npm run build        # tokens:generate → api:generate → tsc -b → vite build
```

The dev server proxies `/api` to a local backend at `VITE_API_PROXY_TARGET`
(default `http://127.0.0.1:8000`). In production the app is served same-origin by
the backend, so `VITE_API_URL` is empty.

---

## What is not here

- **`design/handoff/`** is an archived Figma spec package — do not edit it.
- **Old design mockups** are inspiration, not the product; they are not part of
  this repo's build.
- **The Station** is a theme package (`design/themes/station.json`), not a UI.