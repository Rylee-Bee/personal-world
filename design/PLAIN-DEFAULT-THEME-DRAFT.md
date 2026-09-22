# Plain Default Theme — DRAFT (evolve the generic, don't start a lineage)

**Status:** DRAFT for owner reaction — **not** canonical tokens. On approval it becomes a validated pack
(`design/themes/plain.json` + a `themes.json` registry row, status `canonical`/default) and the first-release
default. Canonical design truth stays `design/tokens.json` until then (design-to-code guardrail: no canonical
change without evidence + approval).
**Owner direction (2026-09-21):** dark-warm by default · plain may carry a recognizable Worlds identity ·
lore/companions/strongly-themed illustration belong to optional packs · evolve the existing generic-theme
work, **no seventh/eighth lineage** · must pass the contrast validator.

---

## What this evolves from (grounded, not invented)

- `design/screens/today-generic-theme.svg` — the **neutral** direction (cool gray `#5C5C64`/`#8A8A94`,
  off-white `#E8E8EC`, darks `#121214`/`#1E1E22`, blue accent `#6B9EFF`, a gold `#D4A547`).
- `media_files/designs/theme-studio/index.html` `--pw-*` tokens — already **dark-warm** (warm off-white text
  `#EDE7DB`, amber `#D4A057`/gold `#C9A227`, calm teal `#5A9E9E`/`#72b1b1`, soft warm shadows, soft radii,
  serif option). This is the warmth seed.
- `design/tokens.json` (aubergine baseline) — the **teal + warm-metal** signature (`#72b1b1` teal,
  `#e4c58d` gold) and the accessibility canon (luminance-only status, 44px, reduced-motion, focus ring).

**The move:** take the generic's *neutrality* and warm it with the theme-studio's *amber + warm off-white +
soft serif* — a calm, neutral-enough dark-warm default that still reads as Worlds. Not a new lineage; the
generic direction, warmed.

---

## Proposed tokens (react to these)

### Surfaces — warm-neutral charcoal (faint umber, not blue/purple)
| Token | Value | Note |
|---|---|---|
| `surface.void` | `#0D0C0B` | deepest |
| `surface.canvas` | `#141211` | page background |
| `surface.panel` | `#1C1917` | cards |
| `surface.elevated` | `#23201D` | popovers |
| `surface.raised` | `#2C2724` | hover/active |

### Text — warm off-white
| Token | Value |
|---|---|
| `text.primary` | `#ECE7DF` |
| `text.secondary` | `#C2BBB1` |
| `text.muted` | `#98918A` |

### Accent — amber warmth + calm teal (the recognizable Worlds pairing)
| Token | Value | Role |
|---|---|---|
| `accent.primary` | `#D4A057` | warm amber — identity, emphasis, active |
| `accent.on_primary` | `#2A1F0E` | text on amber |
| `accent.secondary` | `#72B1B1` | calm teal — links, focus, info |
| `accent.on_secondary` | `#0C2A2A` | text on teal |

### Borders / focus
- `border.subtle` `rgba(236,231,223,0.10)` · `border.strong` `rgba(236,231,223,0.18)`
- `focus.ring` `2px solid #72B1B1` · `focus.ring_high_contrast` `2px solid #FFFFFF` (accessibility canon — unchanged)

### Status — luminance-only (owner accessibility rule, unchanged)
Rank encoded by **luminance + the status word/icon**, never hue alone. Colors are a muted, luminance-ordered
ramp; the word carries the signal (`healthy → warning → unknown → needs_attention → unavailable → stale →
disabled → not_configured`).

### Typography — the warm identity
- **Interface:** `"Instrument Sans", system-ui, sans-serif`
- **Expressive (headings):** `"Young Serif", Georgia, serif` ← the soft serif carries warmth/identity without lore
- **Mono:** `ui-monospace, "SF Mono", "Cascadia Code", monospace`
- base `1rem`, line-height `1.6`

### Spacing / radius / shadow / motion — calm and soft
- spacing `compact .25 · normal .5 · loose 1 · section 1.5rem` (generous, low density)
- radius `control 10px · card 14px · pill full`
- `shadow.soft` `0 10px 30px rgba(0,0,0,0.28)`; optional faint warm glow `0 0 28px rgba(212,160,87,0.06)`
- **motion: reduced by default** (respect `prefers-reduced-motion`)
- **targets:** 44px min / 56px large
- **default appearance: dark-warm**

---

## Gates it must pass (no claim until run)

- `lab design theme validate` → **fails: 0** (body AA ≥ 4.5:1, large ≥ 3:1). *Contrast values here are
  proposed, not yet validated — the harness is the authority.* (Reference: the `moss` pack validates at
  min_body 5.84 / fails 0.)
- Luminance-only status · visible focus · reduced-motion · 44px targets · stable layout (per
  `docs/accessibility/ACCESSIBILITY_CONTRACT.md`).

## Recognizable Worlds identity (allowed) vs lore (NOT in the plain default)

- **In (identity):** the teal + amber pairing · warm off-white text · warm-neutral surfaces · the soft serif
  heading voice · softness/restraint · calm density · gentle, state-explaining motion.
- **Out (→ optional packs):** lore · companions · strongly-themed illustration · Station theming · decorative
  worlds/rooms. The plain default is calm and broadly usable; personality is a pack you add later.

---

## Open questions for the owner (react, don't agonize)

1. **Amber `#D4A057` as the identity accent** — right warmth, or too gold? (Cooler alternative: lean on teal
   `#72B1B1` as primary and keep amber as a rare highlight.)
2. **Surfaces** — warm-neutral charcoal (faint umber, proposed) vs keep them truly neutral gray? How warm
   should the darks feel?
3. **Serif headings (`Young Serif`)** in the plain default — keep for identity, or stay all-sans until packs?
4. **Light-warm option** — build a light variant now, or dark-warm only for the first release?