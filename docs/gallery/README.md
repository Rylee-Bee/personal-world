# Screenshot gallery

> **Status:** Current · **Verified:** 2026-09-26 · **Canonical for:** what Worlds looks like today, screen by screen · **Read this if:** you want to see Worlds without running it, or you are refreshing the pictures after a UI change.

**In short:** Every Worlds screen, at phone (390px) and desktop (1440px)
widths, in the default starfield theme, plus the Bridge in every theme. The
pictures come from fake demo data, never from anyone's real Worlds.

## The gallery

"not yet" means the picture hasn't been taken yet. The table below is
rebuilt by `capture.mjs`; edit `manifest.json`, not the table.

<!-- gallery:start -->
| Screen | 390px | 1440px | State |
|---|---|---|---|
| **Bridge (home)**<br>The Bridge: the guide's briefing, the rooms as doorways, and what needs you. Other themes: [doorways](shots/bridge/doorways-390.png), [station](shots/bridge/station-390.png), [moss](shots/bridge/moss-390.png), [ocean](shots/bridge/ocean-390.png), [plain](shots/bridge/plain-390.png). | [![The Worlds Bridge with a briefing at the top and room doorway cards below. (390px)](shots/bridge/starfield-390.png)](shots/bridge/starfield-390.png) | [![The Worlds Bridge with a briefing at the top and room doorway cards below. (1440px)](shots/bridge/starfield-1440.png)](shots/bridge/starfield-1440.png) | captured 2026-09-26 @ 0738d6f |
| **A room's drawer (Studio)**<br>Looking inside a room: its status in words, its cards, and what needs you, with links that open on the room's own site. | [![The Studio room drawer open over the Bridge. (390px)](shots/room-drawer-studio/starfield-390.png)](shots/room-drawer-studio/starfield-390.png) | [![The Studio room drawer open over the Bridge. (1440px)](shots/room-drawer-studio/starfield-1440.png)](shots/room-drawer-studio/starfield-1440.png) | captured 2026-09-26 @ 0738d6f |
| **Workshop drawer with Secrets**<br>The Workshop room's drawer, including the owner-only Secrets section: names and health only, never a value. | [![The Workshop room drawer showing a Secrets section with station health and key names. (390px)](shots/room-drawer-workshop-secrets/starfield-390.png)](shots/room-drawer-workshop-secrets/starfield-390.png) | [![The Workshop room drawer showing a Secrets section with station health and key names. (1440px)](shots/room-drawer-workshop-secrets/starfield-1440.png)](shots/room-drawer-workshop-secrets/starfield-1440.png) | captured 2026-09-26 @ 0738d6f |
| **Memory**<br>Memory: your journal and records, and finding things in them. | [![The Memory screen listing journal entries. (390px)](shots/memory/starfield-390.png)](shots/memory/starfield-390.png) | [![The Memory screen listing journal entries. (1440px)](shots/memory/starfield-1440.png)](shots/memory/starfield-1440.png) | captured 2026-09-26 @ 0738d6f |
| **Chat**<br>Chat with your guide. Read-only: it observes, and anything it wants to change becomes a proposal you approve. | [![The Chat screen. (390px)](shots/chat/starfield-390.png)](shots/chat/starfield-390.png) | [![The Chat screen. (1440px)](shots/chat/starfield-1440.png)](shots/chat/starfield-1440.png) | captured 2026-09-26 @ 0738d6f |
| **Settings**<br>Settings: voice and tone, companion, theme, and the way into Crew. | [![The Settings screen. (390px)](shots/settings/starfield-390.png)](shots/settings/starfield-390.png) | [![The Settings screen. (1440px)](shots/settings/starfield-1440.png)](shots/settings/starfield-1440.png) | captured 2026-09-26 @ 0738d6f |
| **Crew**<br>Crew: choose your companion, and put a keeper and a doorway on each room. | [![The Crew screen with companions and per-room keepers. (390px)](shots/crew/starfield-390.png)](shots/crew/starfield-390.png) | [![The Crew screen with companions and per-room keepers. (1440px)](shots/crew/starfield-1440.png)](shots/crew/starfield-1440.png) | captured 2026-09-26 @ 0738d6f |
| **Interests (moving to Candy)**<br>Interests: discovery as it lives in Worlds today, before it moves to the Candy room. | [![The Interests screen. (390px)](shots/interests/starfield-390.png)](shots/interests/starfield-390.png) | [![The Interests screen. (1440px)](shots/interests/starfield-1440.png)](shots/interests/starfield-1440.png) | captured 2026-09-26 @ 0738d6f |
| **Projects (parked)**<br>A parked area: an honest placeholder, never pretend data. | [![The Projects placeholder screen. (390px)](shots/projects-placeholder/starfield-390.png)](shots/projects-placeholder/starfield-390.png) | [![The Projects placeholder screen. (1440px)](shots/projects-placeholder/starfield-1440.png)](shots/projects-placeholder/starfield-1440.png) | captured 2026-09-26 @ 0738d6f |
| **First Light (first-run setup)**<br>First Light: the first-run setup, with crew on or off and a companion choice. | not yet | not yet | wanted |
| **Sign in**<br>Sign in: passkey-first when an identity provider is configured, with the access code as a fallback. | not yet | not yet | wanted |
<!-- gallery:end -->

## How it works

- **[`manifest.json`](manifest.json)** says what to capture: each entry has an
  `id`, a `title`, how to reach it (`area` = the navigation button, plus
  optional `steps` such as opening a room's drawer), which `themes` and
  `widths`, a `caption`, `alt` text, and a `status` (`wanted` or `captured`,
  with the date and commit).
- **[`capture.mjs`](capture.mjs)** builds nothing itself. It starts the same
  deterministic mock API the UI tests use (`ui/scripts/e2e-api.mjs`) and the
  production preview build, visits each entry, and saves
  `shots/<id>/<theme>-<width>.png`.
- **`shots/`** holds the pictures, one folder per entry.

## Refreshing the pictures

Run from `ui/`:

```bash
npm run build
node ../docs/gallery/capture.mjs                 # everything capturable
node ../docs/gallery/capture.mjs --only bridge   # one entry
node ../docs/gallery/capture.mjs --all-themes    # every theme for every entry
node ../docs/gallery/capture.mjs --table-only    # rebuild the table only
```

Then look at the new pictures before committing them.

## Rules

- **Mock data only.** This repo is public. Never capture the owner's Worlds
  or any instance with real data, and never commit a picture that shows a
  real name, address, token, hostname or IP.
- **Server-rendered pages** (`/setup` for First Light, `/login`) aren't served
  by the preview build, so the script skips them. Capture them by hand from a
  throwaway local Worlds with a fresh data dir, save them under
  `shots/<id>/`, and set the entry's `status`.
- **To add a screen**, add an entry to `manifest.json` with a caption and
  `alt` text that describe what a person sees, then run the capture.
- **Pictures are a record, not a spec.** Design authority stays in
  [`.project/design/CURRENT.md`](../../.project/design/CURRENT.md); the
  Worlds kit's own component preview is `ui/dist-kit/preview.html`.
