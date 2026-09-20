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
npm run build = tokens:generate → api:generate → tsc → vite build
```

| Step | What it does |
|---|---|
| `tokens:generate` | Reads `design/tokens.json` → generates `src/generated/tokens.css` + `tokens.ts` (4 themes, 53 tokens) |
| `api:generate` | Reads `src/generated/openapi.json` → generates `src/generated/api-types.ts` (typed API) |
| `tsc` | Type-checks all TypeScript |
| `vite build` | Produces `dist/` (~105 kB gz) |

## Updating the API Spec

When the backend adds/changes endpoints:

1. Start the backend: `uv run personal-world api`
2. Fetch the spec: `curl http://127.0.0.1:8000/openapi.json > src/generated/openapi.json`
3. Regenerate types: `npm run api:generate`
4. Add hooks in `src/data/api.ts` and `src/data/hooks.ts`

Or manually edit `src/generated/openapi.json` and run `npm run api:generate`.

## Project Structure

```
ui/
├── src/
│   ├── app/            # App shell, QueryProvider, router
│   ├── components/     # Reusable UI (WorldButton, WorldSignal, WorldDrawer, etc.)
│   ├── screens/        # Page-level components (Today, Journal, Vault, Settings, Chat)
│   ├── data/           # API client, hooks, types
│   ├── generated/      # Auto-generated (tokens, API types, OpenAPI spec)
│   ├── mocks/          # MSW handlers for offline dev
│   ├── stories/        # Storybook stories
│   └── styles/         # CSS (world.css, index.css)
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
