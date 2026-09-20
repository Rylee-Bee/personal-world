# Project Worlds — Frontend Inventory

A friendly map of every frontend piece, where it lives, what it does, what state it's in, and what you need to work on it.

---

## The Big Picture

You have **two stacks** and **two build approaches** in different places. This is confusing — that's not your fault. Here's the breakdown:

| Stack | What | Where |
|---|---|---|
| **The Station (HTML/JS)** | The *live* product UI right now | `personal-world/design/opendesign-exploration/station/` |
| **The React App (new)** | Replacement UI in progress | `pw-vnext-station/ui/` |
| **Browser Tests** | Automated checks against the live Station | `personal-world/frontend/` |
| **Design Tokens** | Colors, fonts, spacing (the truth source) | `personal-world/design/tokens.json` |
| **Design Samples** | Generated HTML mockups | `Rylee-Bee/media_files/designs/portfolio/` |

---

## 1. The Station (the LIVE frontend)

**Where:** `personal-world/design/opendesign-exploration/station/`
**What:** ~40 files of HTML, vanilla JavaScript, and CSS. Served by the backend at `/station/`.
**Status:** ✅ Running. This is what your browser sees today.
**Built by:** OpenDesign + manual edits over months.
**Size:** 656K

### What's inside
```
station/
├── index.html          ← Home page (places hub)
├── chat.html           ← Chat page
├── journal.html        ← Journal page
├── interests.html      ← Interests page
├── station.css         ← Shared styles
├── station.js          ← Main script
├── chat.js             ← Chat logic
├── api.js              ← API client (fetch calls to backend)
├── real-data.js        ← Real-data adapters
├── starmap.js          ← Visual starmap
├── shapemap.js         ← Shape map view
├── deeplink.js         ← URL routing
├── onboarding.js       ← First-run flow
├── search.js           ← Search
├── backup-ui.js        ← Backup UI
├── chars.svg           ← Resident character art
├── icons.svg           ← Icon system
└── *.png / *.jpg       ← Background art, favicons
```

### What it needs to run
- The Python backend (personal-world service on port 8000)
- A modern browser
- That's it — no build step, no Node, no npm

### What state it's in
- ✅ Live
- ⚠️ The frontend React app is meant to *replace* this eventually
- ⚠️ This has been the working UI for months

---

## 2. The React App (the NEW frontend)

**Where:** `pw-vnext-station/ui/`
**Branch:** `feat/station-vnext-foundation`
**What:** A full React 19 + TypeScript + Vite build system. Replaces the Station someday.
**Status:** 🚧 Built but **not wired into the backend yet** — it's a parallel thing.

### What's inside
```
ui/
├── src/
│   ├── app/            ← App shell, QueryProvider
│   ├── components/     ← 8 reusable UI bits
│   │   ├── WorldButton.tsx
│   │   ├── WorldSignal.tsx
│   │   ├── WorldDrawer.tsx
│   │   ├── WorldAssistant.tsx
│   │   ├── WorldAreaLink.tsx
│   │   ├── ResidentPresence.tsx
│   │   └── ...
│   ├── screens/        ← Page-level (Today, Journal, Vault, Settings, Chat)
│   ├── data/           ← Typed API client + 40 React Query hooks
│   ├── generated/      ← Auto-generated (tokens, API types)
│   ├── stories/        ← Storybook stories (8 files)
│   ├── test/           ← Vitest unit tests (21 passing)
│   ├── mocks/          ← MSW mock handlers
│   └── styles/
├── scripts/            ← Token + API type generators
├── e2e/                ← Playwright e2e tests (15)
├── public/             ← Fonts, images, icons
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.e2e.json
├── .env.example
├── .storybook/         ← Storybook config
└── README.md           ← Quickstart docs
```

### What it needs to run
| Tool | Version | Why |
|---|---|---|
| Node.js | 22+ | JavaScript runtime |
| npm | latest | Package manager |
| Backend | running | API calls go to `http://127.0.0.1:8000` (proxied) |
| Browser | any | To view the dev server |

### What state it's in
- ✅ Builds clean (no errors)
- ✅ 60 backend endpoints typed
- ✅ 5 screens (Today, Journal, Vault, Settings, Chat)
- ✅ 8 components ready
- ✅ Storybook builds
- ✅ 21 unit tests pass
- ✅ 15 e2e tests written
- ⚠️ Not serving to anyone yet (no backend wiring)

### How to run it
```bash
cd pw-vnext-station/ui
npm install      # first time only
npm run dev      # starts at http://localhost:5173
```

---

## 3. Browser Tests (for the Station)

**Where:** `personal-world/frontend/`
**Branch:** `main`
**What:** Playwright tests that hit the live Station UI to verify it works.
**Status:** ✅ Active.

### What it needs
- Playwright (`@playwright/test`)
- A running backend with the Station served
- Chromium browser installed (`npx playwright install chromium`)

---

## 4. Design Tokens (the source of truth)

**Where:** `pw-vnext-station/design/tokens.json`
**What:** Colors, spacing, typography — the rules every UI follows.
**Status:** ✅ Active. Both the React app and the Station read from here (via the token generator).

### What's in it
- Color variables (canvas, panel, text, accent)
- Spacing scale (4px grid)
- Typography scale
- 4 themes: moss, ocean, starfield, station

---

## 5. Design Samples (exploration)

**Where:** `Rylee-Bee/media_files/designs/portfolio/`
**What:** ~150 generated HTML mockups from the `lab design` CLI and OpenDesign.
**Status:** ✅ Active. These are *inspiration*, not the product.

---

## What You Actually Need Right Now

To **develop locally**:

| Need | Where to get it |
|---|---|
| Node 22+ | Already installed (via NVM) |
| Python 3.12 | Already installed |
| uv (Python pkg mgr) | Already installed |
| Bazzite/ujust updates | Run `ujust update` when needed |
| Local model inference (Ollama) | Already running |
| A reasonable amount of disk | ~20GB free recommended |
| Sleep | Not negotiable |

To **switch what the world shows**:
- Currently at `/station/` (Station HTML)
- React app at `pw-vnext-station/ui/` (parallel build, not wired)

To **promote the React app to live**:
1. Run it: `cd pw-vnext-station/ui && npm run dev`
2. Wire it into backend (~5 min of code in `api.py`)
3. Test it works
4. Merge `feat/station-vnext-foundation` to `main`
5. The Station becomes the fallback

---

## TL;DR

- **Today the world serves:** the Station (vanilla HTML/JS) at `/station/`
- **In progress:** React app (different stack, different location, branch `feat/station-vnext-foundation`)
- **Tests:** Playwright tests the Station; React app has Vitest + its own Playwright
- **Design truth:** lives in `design/tokens.json`
- **You don't need to choose right now.** Both can run side by side.
