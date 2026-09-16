# HANDOFF — Personal Worlds "Station" UI: complete-fix brief for an agent team

**Date:** 2026-09-16
**Scope:** the design prototype at `design/opendesign-exploration/station/` (served live at `http://<host>:8090/station/`).
**Goal:** make this deployment **whimsical, easy to use for everyone, and modern**, with **all product ideals intact**. This is a one-time handoff; the receiving team owns the UI to completion.

Read this whole file before touching anything. It is the single source of truth for this task.

---

## 1. What this thing IS (do not re-litigate the concept)

The Station is a **semantic systems map**, not a dashboard and not a hub of doors.

- **Landing (`index.html`) = "The systems map."** At rest it shows exactly **seven constellations**: `interests, projects, journal, people, media, systems, places`. Nothing else.
- **Drill in** to a constellation → its **clusters** + relationship lines + a thin info strip (Recently / From / Suggests / Needs-you-here).
- **Drill into a cluster** → its **objects** (a "dive" panel), each with provenance.
- **Complexity emerges only because the user moves toward it.** The page never dumps everything at once. This is the core product idea; preserve it.
- **The taxonomy is user-malleable** ("Shape this map"): add / rename / re-parent / hide / nest nodes, and set how many levels a region reveals. Structure is stored as a patch, not hardcoded.
- **Companions** (Mermaid, Ratatoskr, Robot, Burrito Journalism) are **silhouette presences**, never protagonists. A companion orb (bottom-right) opens a **mini chat dock**; `chat.html` is the same component full-size. **Templates dictate personality** and attach per-companion.
- **"Hail Assistant"** (topbar) is the always-available escape hatch / help dialog. It never says "you're okay."
- **Settings (`settings.html`) = "How this feels"** — a comfort layer above the accessibility floor (density, colours/theme, mood, gentle motion, companions, demand).

Older "deck" pages (`workshop, engine, lighthouse, library, medbay, helm, observatory, promenade`) are **legacy/superseded** exploration. They are not part of the primary IA. Decide keep-as-archive or delete, but do not let them confuse the primary nav.

---

## 2. The IDEALS (hard constraints — never break these)

These come from the repo's Play-Nice adoption + accessibility contract. They outrank aesthetics.

### Accessibility floor
- **44×44px minimum** hit area on every interactive element (buttons, links, selects, summaries, map nodes).
- **WCAG 2.1 AA contrast** in the default presentation; low-glare, no pure-white surfaces, no neon.
- **Keyboard-operable everything**; visible focus ring (teal `#72b1b1` comfortable) never removed for looks.
- **Skip-to-main** is the first focusable element; real landmarks + heading hierarchy.
- **Status is never colour-alone.** Every status has an explicit text label. Size/glow/ring may *reinforce* but never *carry* meaning alone.
- **`prefers-reduced-motion` wins unconditionally.** Ambient/looping motion is **off by default** (opt-in via "Gentle motion"). Event-driven micro-motion (a 180ms drill zoom, a hover lift) is acceptable but must vanish under reduced-motion.
- **200% zoom / small-screen reflow** must not break layout.
- Companion art and icons are **decorative + `aria-hidden`**; the actionable control keeps its own useful label. Turning companions off removes no functionality.

### Attention & honesty
- **Quiet-when-healthy:** "Nothing needs your attention" is a valid, rendered, desirable state. Never a wall of green. Quiet ≠ unknown.
- **No manufactured urgency:** no streaks, guilt copy, countdowns, unread-badge anxiety.
- **Attention flows to exceptions.** The map may grow/ring a node that needs you, but the same number must also appear **in words** (info strip + Needs-you line + aria-label).
- **No fake data, ever.** This prototype shows **honest states**: empty / loading / not_configured / unavailable / stale / unknown. Anything illustrative is labelled **`specimen`**. Real bindings are named (API-051 interests, API-079/033 projects, API-005 journal, API-054 media, API-020 systems, API-010..012 chat, API-030 prefs, API-065 themes).
- **Plain language on the surface** ("needs you", "not set up yet", "Space between things"). The canonical vocabulary (`needs_attention`, `not_configured`, …) lives **one disclosure down** ("technical …").

### Inclusion & personalization
- Works for different bodies, energies, cognitive needs, assistive tech. Low-demand mode keeps the world intact but asks less.
- **Themes / comfort are a layer above the floor**, never below it. Themes restyle atmosphere/accent/density; they never reorder IA or hide capability.
- **Decoration never carries operational meaning.**

---

## 3. Current state — what's GOOD (keep it)

- Topbar nav (World / Interests / Journal / Projects / Chat / Settings) works; active state marked; "Hail Assistant" on the right.
- The systems-map concept renders: organic phyllotaxis scatter, icon planets, orbit rings, graticule + radial scanlines, relationship lines inside regions, info strip.
- Region pages (`interests/journal/projects.html`) open **pre-drilled** into their constellation with a working "Zoom out".
- Settings page layout is clean and plain-language.
- Accessibility chrome present: skip-link, focus rings, 44px targets, `aria` labels, reduced-motion guards.
- Honesty states present (empty chat log, "verified quiet", specimen labels).
- Companion orb + mini chat dock + shared transcript; templates exist per companion.

---

## 4. Current state — what's BROKEN / MISSING (the fix list)

Prioritized. Each item has an acceptance criterion so a reviewer can verify.

### P0 — usability & delight blockers
1. **Planets are too faint/small to feel inviting.** The seven constellations read as dim dots; a first-time user may not realise they're clickable.
   - *Fix:* raise base planet size and luminance; strengthen glow; make the "clickable" affordance obvious (hover/focus lift + label emphasis + persistent ring on drillable). Keep contrast AA and don't let glow become glare.
   - *Accept:* at a glance the seven worlds are clearly visible and obviously interactive; screenshot shows legible labels without hovering.
2. **Chat templates are hidden inside a closed `<select>`.** Users see only "Free talk"; the personality templates are undiscoverable.
   - *Fix:* render templates as **visible chips/cards** (label + one-line personality), not a dropdown. Selecting a chip sets the personality line + prefills the prompt. Keep keyboard operable (real buttons, focus ring).
   - *Accept:* on `chat.html` and the mini dock, all templates for the current companion are visible without opening anything.
3. **Chat empty state is a bare grey box.** Not inviting; no sense of the companion's presence/personality.
   - *Fix:* warmer empty state: companion silhouette + a short in-character invitation + 2–3 starter chips. Still honest (no fake replies).
   - *Accept:* empty chat feels like a room someone is in, not an error box.

### P1 — content depth (the map currently dead-ends)
4. **Drilling into a cluster shows only a thin dive list.** There's no real "content view."
   - *Fix:* give at least **Projects** a simplified **GitHub-like view** (repo header, branch/ahead-behind chips, file tree, recent commits, a clearly-gated "propose refresh" that explains observe→diff→propose→approve→act). Give **Journal** a readable entries view and **Interests** a discoveries view — all specimen-labelled, all honest states.
   - *Accept:* entering Projects/Journal/Interests shows a purposeful content surface, not just nodes.
5. **"Hail Assistant" reliability.** Confirm it always opens the help dialog (focus moves in, Esc closes, focus returns).
   - *Accept:* keyboard-only user can open, act, and close without a mouse.

### P2 — whimsy & modern polish (the "make it delightful" pass)
6. **Micro-interactions:** hover/focus lift on planets & cards; a subtle idle float on planets **only when Gentle motion is on**; smooth (≤200ms) drill transitions. All reduced-motion-safe.
7. **Empty/edge states as designed moments:** every empty state should read as an invitation with a next action, in the product's warm voice.
8. **Typography & spacing rhythm:** consistent scale, generous but not airy; the serif display for place-names, sans for UI, mono for data/technical.
9. **Cohesive sci-fi atmosphere:** starfield + nebula + horizon are good; ensure they never reduce text contrast or cause glare; keep them behind content (`z-index`), `aria-hidden`.

### P3 — housekeeping
10. **Legacy deck pages:** archive or delete `workshop/engine/lighthouse/library/medbay/helm/observatory/promenade`. If kept, mark clearly as archive and remove from any primary nav.
11. **Remove dead code/CSS** that no longer applies (e.g., old `.shell-nav`, unused door/concourse styles) to keep the stylesheet maintainable.
12. **Verify every Settings control actually changes something** and persists (density, theme, mood, motion, companions, demand).

---

## 5. File map (where things live)

```
station/
  index.html        World / the systems map (landing)
  interests.html    pre-drilled Interests region
  journal.html      pre-drilled Journal region
  projects.html     pre-drilled Projects region
  chat.html         Talk (full chat component)
  settings.html     How this feels (comfort layer)
  station.css       ALL styling (tokens, floor, map, chat, settings, chrome)
  station.js        prefs + injected chrome (companion orb, help btn/dialog, dock)
  starmap.js        the systems-map engine (render, drill, structure patch, mood)
  chat.js           chat component (templates, transcript, mini + full)
  shapemap.js       "Shape this map" structure editor
  chars.svg         companion silhouettes (currentColor)
  icons.svg         planet/interest glyphs (currentColor)
  *.html (legacy)   superseded deck pages — archive/delete (P3)
```

Served by a pre-existing static server at `http://<host>:8090/station/`. **Do not** start a second server on 8090 (address in use).

---

## 6. How to work & verify (the team's loop)

1. **Edit** the file(s).
2. **Drive the real browser** to verify (this is the owner's browser; it reflects the live deployment):
   ```
   opencli browser chrome open "http://<host>:8090/station/<page>.html?v=<cachebust>"
   opencli browser chrome screenshot /tmp/shot.png
   convert /tmp/shot.png -resize 880x -quality 58 /tmp/shot.jpg   # downscale before reading
   ```
   - **Run open/screenshot SEQUENTIALLY in one shell command** (parallel calls race the same tab).
   - **Always cache-bust** (`?v=n`) or the browser serves stale CSS/JS.
   - **Downscale screenshots** before reading them into context (full-size PNGs blow the request limit).
3. **Check the ideals** after each change:
   - 44px: `opencli browser chrome eval` a quick audit over `button,select,input,summary,a` for `getBoundingClientRect().height < 43.5`.
   - No horizontal overflow: `document.documentElement.scrollWidth <= window.innerWidth+1`.
   - Reduced-motion: emulate and confirm ambient animation stops.
4. **Keep changes uncommitted** until the owner approves the direction (current working tree is intentionally dirty).

---

## 7. Definition of DONE

- [ ] All P0 items fixed and verified by screenshot + interaction.
- [ ] P1 content views exist for Projects (GitHub-like), Journal, Interests.
- [ ] P2 whimsy pass applied consistently; reduced-motion still clean.
- [ ] P3 housekeeping done (legacy archived, dead CSS removed, settings verified).
- [ ] A fresh accessibility audit passes: 44px, contrast AA, keyboard, focus, skip-link, reduced-motion, no colour-alone status.
- [ ] No fake data introduced; all illustrative content labelled `specimen`; honest states intact.
- [ ] The seven-constellation rest state, drill-down, user-malleable structure, and companion/chat model all still work.
- [ ] Owner has looked at it and said it feels whimsical, easy, and modern.

---

## 8. Tone for the team

This product stands for **accessibility, attention-protection, and inclusion**. Whimsy is welcome — glow, drift, charm, delight — but it must never cost a low-vision user, a keyboard user, a reduced-motion user, or a tired user anything. **Make it beautiful *and* make it kind.** When in doubt: plain words, honest states, big targets, calm defaults.

Good luck. The map is the product; the ideals are the floor; the whimsy is the ceiling. Raise the ceiling without cracking the floor.
