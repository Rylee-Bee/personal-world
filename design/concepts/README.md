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
| `today-renai.html` | **Today, as Renai keeps it** — the same room, *made by its resident*: letters, the telling (real speech), her marginalia |
| `today-focus.html` | **Today with the focus on** — a *perception layer* over the room: world tags, scan-to-reveal, cards docked to what they annotate |
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
(`assets/packets/`), the fonts (`assets/fonts/`), and a few skies and room photos
used by the exploration pages.

## The scroll card (shared surface)

Rooms are built from one shared **scroll** card: a sheet of night-vellum with
leaf-cut corners, a gold hairline frame, a scribe's tapered stroke along the top,
and a gold **seal** beside the heading. It **wakes** on hover/focus (the frame
brightens); the seal **twinkles only when the OS allows motion**
(`prefers-reduced-motion: no-preference`) and is perfectly still otherwise.

It is defined once, in `today-room.html`, as the `.panel, .assist, details.depth`
block. Reuse that block in the next rooms — do not invent a new surface.

**Type — storytellers, not scientists.** Room names are **Cormorant** (calligraphic
display); reading text is **Spectral** (a literary serif); the *technical depths*
stay **IBM Plex Mono**, so the surface is *written* and the machinery is, literally,
a different hand. All self-hosted — see
[`assets/fonts/README.md`](assets/fonts/README.md).

**The culture (canonical: `docs/STATION-MAP.md` §6).** This is a literate, oral
society that went to space: the interface is **written and spoken**, never a beep.
Every resident *builds their own tools* in their own medium — `today-renai.html` is
the worked example (Renai's room as **letters and the telling**, with real, optional
speech and text always present).

**Actions flow to one place.** Every card puts its controls at the end of the
reading flow, right-aligned — `.rowact` per item, `.actions` per card — always
≥44px, always **real** (no dead buttons), with a polite status region for changes.

**Modules, and a device you can touch.** Each card is a `.m` module on a grid with
a numbered header, a **fold** control (real, keyboard-operable), and touch
affordances: 48px targets, `touch-action: manipulation`, `:active` press states,
and a `:focus-within` "wake" so touch and keyboard get the same feedback as hover.
A floating **Ask** button keeps the assistant within thumb reach — a real control
that opens the assistant module and focuses its input.

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