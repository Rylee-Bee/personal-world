# THE SEMANTIC MAP — navigation & content model
## Owner-articulated core concept, recorded 2026-09-16

> "This is not a dashboard laid out in space. It is a semantic map of the
> user's world. At low complexity, show only the major constellations. As the
> user zooms or enters a region, reveal clusters, relationships, recent
> activity, provenance, recommendations, and individual objects. Complexity
> should emerge because the user moves toward something, not because the page
> dumps everything at once."

> "I have wanted the simple layer that drills down to the very commands the
> thing is doing, this whole time, and this star map did it for me."

---

## The model

**Landing = The Observation Deck.** Not a "Promenade", not a hub of doors.
The front door is the map of your world. (Earlier "Promenade" theming removed
2026-09-16 at owner direction.)

**Depth 0 — galaxy.** Exactly seven constellations, nothing else:
`interests · projects · journal · people · media · systems · places`.

**Depth 1 — region.** Enter a constellation and it reveals its **clusters**,
the **relationships** between them (lines), plus a thin info strip carrying
**recent activity**, **provenance**, and **the World's suggestion**.

**Depth 2 — cluster.** Select a cluster and it reveals **individual objects**,
each carrying its source and timestamp, plus a **technical disclosure** showing
**the exact command / endpoint underneath** and the write-safety chain
(`observe → diff → propose → approve → act → re-observe`).

**Complexity is earned by movement.** The page never renders depth the user
has not walked to. This is `complexity-on-demand` + `progressive-disclosure`
made spatial.

---

## Attention is carried by the map itself

- A node **grows slightly** with the number of items inside that need you
  (`--nscale`, capped), and wears a **gentle status ring**.
- The ring is **static by default**; it only breathes when the user opts into
  gentle motion, and never under `prefers-reduced-motion`.
- **Redundancy rule:** the same number is always present as **text** on the
  node and in its accessible label. Size and colour never carry meaning alone
  (accessibility-floor 1.3 / 1.4).
- Quiet regions stay quiet. `quiet-when-healthy` applies to the map too.

---

## Naming discipline (owner: "reduce naming to be accessible")

- **Surface = plain human words.** "Space between things", "Colours",
  "Needs you", "Ask less of me". Status reads "needs you", "not set up yet",
  "not sure yet", "a while old" — never `needs_attention` / `not_configured`
  in the open.
- **Canonical vocabulary + endpoints live one disclosure down**
  (`details.tech`), for the moments you want the machinery.
- **The UI hides how complex settings are.** Surface offers two or three plain
  choices; the deep preference schema sits behind one "More settings"
  disclosure. Capability is never removed — only its jargon is.
- **Fewer names, less splitting.** The ornate seven-deck taxonomy
  (Observatory / Workshop / Lighthouse / Library / Medbay / Helm / Engine) is
  no longer the primary IA. The map's constellations are the IA; the old deck
  pages remain as deep links under `places → decks`, not as a wall of doors.

---

## The command layer (why the drill-down matters)

The underlying system is a built-in CLI that wraps small apps. The map's
technical disclosure names the real verb for each region, e.g.:

| Region | Command underneath |
|---|---|
| galaxy | `personal-world status` |
| interests | `personal-world discovery interests` |
| projects | `personal-world repo status` |
| projects → personal-world | `repo diff → propose → approve → act → re-observe` |
| journal | `personal-world journal list` |
| systems | `personal-world lab health` |
| media | `personal-world media library` |

So one simple surface reaches, without a seam, from "what is interesting to me"
down to "the exact command being run." That continuity is the product.

---

## Companions in this model

Companions are **presences that travel with you**, not protagonists:
- A single companion chip, fixed bottom-right on every page, links to Chat.
- Silhouette iconography only (single-colour `currentColor` marks), never
  emoji, never detailed illustration.
- Optional easter eggs: a silhouette tucked into a node (hover/focus), and a
  rare ambient visit. Both decorative, dismissible, never announced, off via
  the companions preference, suppressed under reduced motion.
- Decoration never carries operational meaning (themes-and-personalization).

---

## Escape hatch

"Hail Assistant" is the topbar escape hatch on every page. It never says "you're okay."
It offers the smallest possible next step and can drop the world to
**low demand** (keep everything, ask less). See `PLAY-NICE-CONFORMANCE.md`.

*Implementation: `station/starmap.js` (map), `station/station.js` (prefs +
persistent chrome), `station/station.css` (floor + layers), `station/index.html`
(The Observation Deck).*
