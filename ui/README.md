# Project Worlds — Station vNext UI

React + TypeScript + Vite + Tailwind v4 frontend for the Station UI.

## Quickstart

```bash
# Install dependencies (first time only)
npm install

# Start dev server (proxies API to backend on :8000)
npm run dev

# Build for production
npm run build
```

Dev server runs at `http://localhost:5173` and proxies `/api` requests to `http://127.0.0.1:8000` (the FastAPI backend).

## Prerequisites

- Node.js 22+
- Backend running on port 8000: `uv run personal-world api` or `docker compose up`

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `""` (same-origin) | API base URL. Leave empty when using the Vite proxy. |

## Build Pipeline

```
npm run build = tokens:generate → api:generate → tsc -b → vite build
```

| Step | What it does |
|---|---|
| `tokens:generate` | Reads `design/tokens.json` → generates `src/generated/tokens.css` + `tokens.ts` (4 themes, 53 tokens) |
| `api:generate` | Reads `src/generated/openapi.json` → generates `src/generated/api-types.ts` (typed API) |
| `tsc` | Type-checks all TypeScript (strict) |
| `vite build` | Produces `dist/` (~107 kB gz) |

## Updating the API Spec

The deployed Station **disables `/openapi.json`** (HTTP 500) and
auth-gates every data endpoint, so the spec cannot be fetched from a
live instance. `src/generated/openapi.json` is a hand-maintained
fixture (this is the documented workflow below); its UI-consumed
endpoints were aligned to the server source on 2026-09-20.

When the backend adds/changes endpoints:

1. Read the handler in `src/personal_world/api.py` (+ `auth_routes.py`,
   `prefs.py`, `sections.py`, `model.py`, `status.py`, `envelope.py`) —
   the SERVER is truth; the spec must describe its real envelope.
2. Edit `src/generated/openapi.json` accordingly.
3. Regenerate types: `npm run api:generate`.
4. Update the front-door client in `src/fd/api.ts` and the MSW handlers
   in `src/fd/msw.ts` (mocks must mirror the real envelope or they teach
   fiction).

If a deployment ever re-enables schema export, `curl
http://127.0.0.1:8000/openapi.json > src/generated/openapi.json`
replaces the fixture wholesale.

## End-to-End Tests

```bash
npm run build && npm run test:e2e
```

Playwright runs the front-door suites (see `playwright.config.ts`):
`e2e-fd/` against a mocked API (`page.route`, fixtures in
`src/fd/fixtures.ts`) on a Vite dev server (port 4180, no backend),
and `e2e-fd-live/` against the real read API
(`python -m personal_world.worlds.dev`) through the Vite proxy on
port 4181. Phone (390) and desktop (1280) are both first-class.

## Project Structure

```
ui/
├── src/
│   ├── app/            # QueryProvider
│   ├── data/           # TanStack Query client
│   ├── fd/             # Front-door UI (shell, screens, CSS, API client, fixtures)
│   ├── generated/      # Auto-generated (tokens, API types, OpenAPI spec)
│   └── test/           # Vitest unit tests
├── e2e-fd/             # Playwright e2e against the mocked API
├── e2e-fd-live/        # Playwright e2e against the real read API
├── scripts/            # Token + API type generation
├── public/             # Static assets (fonts, images, icons)
└── dist/               # Production build output
```

## Key Technologies

- **React 19** + **TypeScript 5.9**
- **Vite 8** (build) + **Oxlint** (lint)
- **Tailwind v4** (styling via CSS variables)
- **React Aria Components** (accessible primitives)
- **TanStack Query** (server state)
- **openapi-fetch** + **openapi-typescript** (typed API)
- **Style Dictionary** (token pipeline)
- **Storybook 10** (component dev)
- **Vitest** + **Playwright** (testing)
- **MSW** (mocking)

## Accessibility

All UI follows the accessibility contract in `docs/accessibility/ACCESSIBILITY_CONTRACT.md`:
- 44×44px minimum hit areas
- Focus always visible (teal ring)
- Skip-to-main-content on every page
- Status by text, never color alone
- No animation/shimmer loading states
- Keyboard-operable throughout
