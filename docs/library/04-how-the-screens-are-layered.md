---
title: How the screens are layered
kind: book
order: 4
for: everyone
---
Every color, size and space on a Worlds screen comes from a **token**: a
named value like "the text color" or "the small gap", never a raw number
typed into a screen.

The names live in one file, `design/tokens.json`. The values come from the
layers below.

* * *

There are three layers, from bottom to top:

1. **The invariant core.** Surfaces, text colors, type, spacing, the focus
   ring, 44-pixel touch targets and the accessibility contract. No theme
   and no setting may break these.
2. **The theme.** Starfield (the default), Daylight, Moss, Ocean, Plain,
   Doorways, Station. A theme changes the look within the core's rules.
3. **Your own settings.** Motion, contrast, text size, density, target
   size. These sit on top of any theme.

* * *

How it's built: a small script turns the token names and each theme's values
into CSS variables (`--pw-...`), one block per theme. Your settings become
attributes on the page (`data-pw-motion`, `data-pw-contrast`...). Screens
only ever use the variables.

That's why a new theme needs no screen changes, and why "reduce motion"
works everywhere at once.

* * *

Why it matters: a screen that types its own color breaks the day someone
picks Daylight or high contrast. A screen that uses tokens gets every theme,
and every accessibility setting, for free.

**Learn more:** `design/THEME_PACK_FRAMEWORK.md`, `design/tokens.json`,
`docs/accessibility/ACCESSIBILITY_CONTRACT.md`.
