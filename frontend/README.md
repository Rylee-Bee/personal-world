# Project Worlds — browser gate (Playwright)

The **Station** (`/station/`, served by the backend) is the product UI.
This directory holds only the browser gate for it: Playwright + axe specs
in `e2e/`, run against the real app booted by `e2e/server.mjs` with a
seeded world.

The superseded React frontend was removed 2026-09-16 (single-branch
cutover). `/login` and `/setup` are server-rendered; the old React SPA and
its dist build are gone.

## Commands

```sh
npm ci                  # install playwright + @axe-core/playwright
npx playwright install  # first run only: fetch the browser
npm run test:e2e        # or: npx playwright test
```

## Specs

- `station-a11y.spec.ts` — axe with color-contrast ENABLED, 44px floor, console gate
- `station-honest-states.spec.ts` — no fake data: verified-quiet vs unavailable sources
- `station-keyboard.spec.ts` — skip-link, nav, dialogs, the full map journey
- `station-motion-reflow.spec.ts` — reduced motion by default, 360px reflow, 200% zoom

## Notes

- Accessibility truth lives in `docs/accessibility/ACCESSIBILITY_CONTRACT.md`.
- `e2e/server.mjs` boots the real FastAPI app under uvicorn with a fresh
  seeded world; no build step is required (the Station is static and
  shipped in the repo).