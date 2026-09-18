# Station design concepts

**Status:** concepts, not implementation. Nothing here is wired into
`src/` or the served Station. These are the design pages used to explore the
Station's rooms, dialects and voice; they are kept in the repo so the design work
is versioned, not only local.

**Index:** open `packets.html`.

## What is here

| Page | What it is |
|---|---|
| `packets.html` | the index — links every page below |
| `today-room.html` | **Today** (the first real room) at product scale — the reference for room work |
| `dialects.html` | one world, eight dialects — the room-identity sheet |
| `p1`–`p8`, `p10-transmission.html` | the eight divergent layout packets (+ the deck × postcard fusion) |
| `hub.html`, `station.html`, `crew-maker.html` | the Ring home, the all-rooms view, and the resident-maker |
| `art.html`, `console.html`, `crew.html`, `today-concept.html` | earlier concept/exploration pages |

## How to view

These are static pages that read the canonical art by relative path. Serve the
repository root and open the index — no build step:

```
python3 -m http.server 8899        # from the repository root
# then open http://127.0.0.1:8899/design/concepts/packets.html
```

## Assets — one owner, no copies

The art is **not** duplicated here. These pages reference the canonical set:

- room backdrops → `../assets/station/backgrounds/`
- resident cutouts → `../assets/station/characters/` (and `../assets/crew/`)
- the bed icon → `../assets/station/icons/bedicon.png`

Only concept-specific files live under `assets/` here: the index thumbnails
(`assets/packets/`), the display face (`assets/fraunces-*.woff2`), and a few skies
and room photos used by the exploration pages.

## Rules these pages follow

The accessibility floor and the room conventions are canonical elsewhere and are
not restated here:

- [`docs/accessibility/ACCESSIBILITY_CONTRACT.md`](../../docs/accessibility/ACCESSIBILITY_CONTRACT.md)
- [`docs/STATION-MAP.md`](../../docs/STATION-MAP.md) — the deck map, the dialects,
  and the "rooms announce themselves" rules (label = the plain job word; dialect =
  the invented visual language; accessibility is the floor, cuteness is the layer
  above it).

Concepts may explore freely, but the floor above them does not move: dark by
default, 44&nbsp;px targets, real labels, motion off unless the OS allows it, and
no meaning carried by colour alone.