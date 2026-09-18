# ART REQUESTS — what to ask for, and how to ask

Status: a practical request sheet. Grounded in the owner crew sheet
(`design/screens/crew.png`) and `docs/CHARACTER-HANDBOOK.md`. Companions are
described in `docs/COMPANION-CANON.md`. Art direction: `design/COMPANION_INTEGRATION.md` → "Art direction".

## 1. Paste this first — the style clause

> Match the Project Worlds crew sheet. Every character wears the **same dark
> uniform with gold trim and the same combadge**. Pastel-to-saturated palette,
> crisp dark outlines, large expressive eyes with highlights, rosy cheeks,
> sparkle accents. Warm, painterly, cozy lighting on a deep navy / space
> background. **Cute but competent** — adventurer/astronaut energy, not
> infantilised. Siblings in art direction, each with a **completely distinct
> silhouette**. No text baked into the artwork.

## 2. Ask for this next (highest value first)

1. **A full character sheet per companion**, like the poster: front /
   three-quarter / side / back, an expressions row, uniform detail insets, and a
   combadge close-up. Deliver a flat sheet **and** a transparent-background cutout.
2. **A six-pose state sheet per companion**, matching the design's emotional
   states: `REST` (quietly here) · `CURIOUS` (something caught my attention) ·
   `ATTENTIVE` (I'll keep watch) · `ENGAGED` (how can I help) · `PROTECTIVE`
   (keeping watch) · `GIVING SPACE` (absent / quietly here). These map to real
   companion behaviour, so they are worth more than random poses.
3. **The combadge on its own** — large and clean — plus 4–6 small variants if
   each role has its own.
4. **A scale sheet**: the same character at micro (16–20px), nav (32px), inline
   (48px), empty (64px), error (64px), feature (96px+), so the silhouette reads
   at every size.
5. **A wide "the crew together" scene** (like the poster's bottom band), roughly 3:1.
6. **Icon set**: the crew emblem + the five silhouette marks, as app icon / favicon sizes.

## 3. Per-character clauses (paste when asking for one)

- **Renai** — "a pastel mermaid with a rainbow braid, gold gaze, uniform combadge;
  **Explorer · Companion · Dreamer**; curious and lyrical, follows the current of
  thought; wonder, reflection, personal continuity; the **least task-oriented**
  of the crew."
- **Ratatoskr** — "a Norse messenger squirrel beneath Yggdrasil: lavender cloak,
  gold brooch, blue cap, messenger satchel, acorn; the world-tree's leaves are
  tiny books; **Scout · Guide · Explorer**; quick and a little mischievous; runs
  between worlds carrying knowledge."
- **Bolt** — "a small round helper robot with a glowing antenna; **Helper ·
  Learner · Good Company**; plain and careful, allergic to shortcuts; competence
  without omniscience; can just be tinkering quietly."
- **Burrito Journalism** — "a breakfast burrito truck with a news sign and warm
  lights; **News · Snacks · Stories · Everywhere**; warm newsroom voice, background
  before breaking; gloriously weird — keep it that way."
- **Personal World** — "a small smiling planet with a golden ring; **Home ·
  Connection · Possibility**; the spirit of the place, not a chat personality; it
  expresses through light and constellations more than dialogue."

## 4. Format to ask for (so the result is usable)

- Transparent-background PNG cutouts **plus** the flat sheet.
- **Vector / SVG export** where possible (the current owner set is SVG — crisp at any size).
- **No text baked in** — we label in code.
- A consistent canvas size across the set.
- Front / ¾ / side / back and expressions delivered as a grid.
- Uniform and combadge delivered separately too, so they can be reused.

## 5. Do not

- Change the uniform or drop the combadge — that is what makes them a *crew*.
- Make them human, angry, needy, or infantile.
- Bake in text, watermarks, or UI chrome.
- Regenerate or replace the existing art — **add** to it.
- Use a saturated hue as the only signal for anything meaningful.

## 6. The one-liner to remember

> "Same crew, same uniform, different worlds — **cute but competent**, warm
> painterly light, and a distinct silhouette for each."

---

## 7. Still missing — the current gap list (2026-09-17)

Character work is **done** (see "What already exists" below). What remains is
mostly implementation-ready assets, plus four undrawn areas.

| Still missing | Why |
|---|---|
| **Transparent cutouts** | Almost every file is opaque (`alpha=False`) — composed with a background/panel. The UI needs each character isolated on transparency. Only `crew2`, `mermaidchar`, `renai2`, `worlds` carry alpha. |
| **Vector / SVG (or the source)** | All PNG today. The screen designs ship SVG; the crew needs the same for crisp scaling and tinting. |
| **The six product states, labeled** | The sheets have "Six Key Poses"; the Station reacts to `REST · CURIOUS · ATTENTIVE · ENGAGED · PROTECTIVE · GIVING SPACE`. If those poses are not mapped to those, that is the one character gap. |
| **Four undrawn areas** | Rooms exist for Interests, Projects, Journal. **People, Media, Systems, Places** have no art. |
| **App icon + favicon files** | Shown on the sheet; need the exported `.ico` / `.png` sizes. |
| **Per-area "sky" / backgrounds** | So each area feels like a place. |
| **Three attention-voice motifs** *(optional)* | Small marks for GOOD NEWS · A SMALL UPDATE · WHEN YOU'RE READY. |

**One-line ask:** cutouts + vector, the four areas, and the exported icon files
— the characters themselves are already excellent.

### What already exists (so nothing is re-requested)

- **Master sheets:** `crew.png`, `crew2–5` — turnarounds, expression rows, six key
  poses, uniform details, combadge + variants, scale sheet, icon set, "The Crew Together".
- **Per-character sheets:** `mermaidchar.png`, `ratataskor.png`, and the rest in
  `design/owner/crew/`.
- **Scale sheet** with sizes: 16 Micro · 32 Nav · 48 Inline · 64 Empty · 64 Error · 96 Feature.
- **Icon + sticker library:** `icons.png` (characters, symbols, books, map, world-tree, foliage, weather).
- **Wide crew scene:** `design/screens/crew-scene-sept17.png` (tracked).
- **Crew portrait:** `design/screens/worlds.png` (tracked).

Owner drops live in `design/owner/crew/` (gitignored); curated pieces are promoted
to `design/screens/`.