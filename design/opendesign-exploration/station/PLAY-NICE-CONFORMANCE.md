# STATION DESIGN — PLAY NICE CONFORMANCE
## How the Personal Worlds Station is bound by adopted contracts

**Adoption:** `.project/contracts/adoption.yaml` → `Rylee-Bee/play-nice-contracts`
@ `f825ffb` (v0.7.0). The Station design is human-facing UI work, so the
`human-facing`, `ui`, and `design` trigger sets apply in full, plus all `always`
contracts.

This document states, in the repository, what the design stands for and how it
conforms. It is a design-layer conformance statement; the canonical contract
texts live in the shared library and are not copied here.

---

## WHAT THIS PROJECT STANDS FOR (owner intent)

Accessibility. Attention. Inclusion. These are not features; they are the
reason the product exists. The Station must be a place where:

- **Anyone** can use it, at any energy level, with any assistive technology.
- **Attention is protected** — the world asks for you only when it truly needs you.
- **Difference belongs** — different interests, cultures, bodies, cognitive needs,
  and ways of living all have room. The crew (a mermaid, a squirrel, a robot, a
  journalism truck, a living world) is the literal metaphor: nobody has to become
  more like the others first.

---

## BINDING CONTRACTS → DESIGN CONFORMANCE

### accessibility-floor (human) + local `docs/accessibility/ACCESSIBILITY_CONTRACT.md`
- WCAG 2.1 AA contrast in the default "comfortable" presentation, low-glare.
- Status is **never color-alone**: every status carries an explicit text label
  (`healthy`, `needs_attention`, `unavailable`, `stale`, `unknown`,
  `not_configured`, `disabled`).
- 44×44px minimum hit areas. Keyboard-operable everything. Visible focus
  (teal `#72b1b1` comfortable / white high-contrast), never removed for aesthetics.
- Skip-to-main is the first focusable element. Real landmarks + heading hierarchy.
- No shimmer/pulse/animated skeletons for loading. No neon, no pure-white surfaces,
  no bright saturated blue.
- `prefers-reduced-motion` respected unconditionally. 200% zoom/reflow safe.
- Companion art is decorative + `aria-hidden`; the actionable control keeps its own
  useful label. Companion-off removes no functionality.
- **Conformance in the prototype:** `station.css` implements skip-link, landmarks,
  focus-visible, 44px targets, text status labels, static loading, reduced-motion.

### attention-and-focus (human)
- The default surface answers, in order: **What needs me? What was I working on?
  What is coming up?** → the Station hub leads with an *Orientation* band in this order.
- Attention flows to **exceptions, not routine success**. No walls of green.
- **No manufactured urgency**: no streaks, guilt copy, countdown pressure, unread-badge
  anxiety. Backlog size is never artificial pressure.
- Externalize memory: state, next-action, and why-it-matters live in the environment.
- One obvious path; depth via progressive disclosure.
- **Conformance:** Orientation band = a single ranked "what needs me" list (real
  reminders/proposals/attention), then "what was I working on," then "what's coming up."

### quiet-when-healthy (experience)
- "Nothing needs your attention" is a **valid, rendered, desirable state**.
- Health is visible on demand, not loud by default. One reachable overall status
  beats a wall of per-check green.
- **Quiet ≠ unknown.** Quiet means verified-healthy; if unverified, say `unknown`.
- **Conformance:** every neighborhood renders an explicit all-quiet path and a
  distinct unknown path; the hub shows one calm overall line when healthy.

### complexity-on-demand + progressive-disclosure (human/experience)
- Level 1 (glance) comprehensible alone; Level 4 (technical) always reachable.
- The Station's disclosure ladder: Answer → Why → Evidence → Technical detail.
- **Conformance:** neighborhoods open at glance-level; `<details>`/drawers carry depth.

### themes-and-personalization (experience) — *the inclusion/expansion hook*
- Layering, never violated downward:
  `PLATFORM → ACCESSIBILITY FLOOR → USER COMFORT → THEME/PERSONALITY → DECORATION`.
- Every theme ships against the same accessibility floor, verified.
- **Decoration never carries operational meaning** (a mascot is never a status indicator).
- Themes are switchable/removable; turning one off loses no functionality.
- Themes alter **presentation slots defined by the core**; they do not reorder
  information architecture or invent navigation.
- **Conformance:** the Station exposes a theme slot (bound to the real
  `GET /api/themes` API-065, currently an ACTIVE API with no UI consumer). Themes
  restyle atmosphere/accent/density within the floor; they never change IA or hide
  capability. This is how the world stays **expandable for others and their own themes**.

### migraine-and-sensory-safety + low-vision-and-reflow + motion-and-feedback (human/ui)
- Low-glare, restrained luminance; no flashing/parallax/shimmer; motion is
  event-driven and rare; reflow-safe at 200% and on small screens.
- **Conformance:** `station.css` keeps motion minimal + event-driven; reduced-motion
  first-class; layouts reflow to one column.

### copy-and-language + what-why-next (experience)
- Plain, warm, specific language. Every surfaced item can state What / Why it matters
  / Next. "Nothing needed" is representable.
- **Conformance:** orientation items and discoveries carry what/why/next; calm lines
  are honest, not chirpy.

### capability-first + provider-neutrality + failure-and-degradation (external-api/api)
- Providers are machinery; world state is durable. Never hard-code a provider into UI.
- Preserve `not_configured`, `unavailable`, `stale`, `partial`, `error` honestly.
- **Conformance:** each neighborhood binds to real capability-backed endpoints
  (see `STATION-DOMAIN-MAP.md`) and renders every degraded state; no fake success.

### provenance-and-audit + truth-and-evidence + explicit-state + assume-unknown (always)
- Every discovery shows where it came from / why it's here / who found it.
- Unknown is a first-class state, never disguised as healthy or as content.
- **Conformance:** provenance lines on discoveries; explicit unknown states.

### participation-and-contribution + mutual-contribution + collaborative-good-faith (always)
- The world is co-owned and co-shaped: sections are user-orderable (API-032),
  themes are user-owned (API-065), packs installable (WORLD-007). The Station is a
  home people add to, not a product imposed on them.

---

## THE EXISTING INTERFACE IS NOT THE ENEMY

The current React frontend (`frontend/src/**`) is competent, well-tested, and
truthful — it simply never *fit* the emotional vision. The Station does not replace
its domain logic, APIs, security model, or tests. It provides the **home** that
system was always meant to live in:

- Reuse: `StatusChip`, `Disclosure`, `Dialog`, `Drawer`, `LiveRegion`,
  `StepUpPrompt`, `CompanionSlot`, `lib/capability-health.ts`, `lib/project-status.ts`,
  `lib/observation-age.ts`, `lib/projection.ts`.
- The Station layers **atmosphere + orientation** over existing domain truth.
- Nothing here deletes or weakens an accessibility check to look better.

---

## ACCEPTANCE (design-layer)

A Station screen passes when:
1. The single most important thing is findable in the first screen-second.
2. A fully healthy day costs near-zero attention, and says so explicitly.
3. Quiet is never confused with unknown.
4. Nothing requires remembering what isn't written down.
5. It works with no illustration, reduced motion, keyboard-only, screen reader,
   alternate companions, and providers offline.
6. A theme can restyle it without breaking the floor or the IA.
7. It never manufactures urgency or guilt.

*Stated in-repo 2026-09-16. Contracts canonical in the shared library; this file
records design-layer conformance only.*
