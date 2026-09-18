# HANDOFF — Station UI improvement orchestration (access · optimize · clarify · delight)

**Date:** 2026-09-17
**Author:** incoming design-review pass (opencode + frontend-design skill), owner-requested
**Scope:** the Station UI (`design/opendesign-exploration/station/`, served at `/station/`)
**Type:** review → fix-lane orchestration. Not a redesign. The concept (semantic star map, honesty floor, quiet-when-healthy, companions) stays.

Read `AGENT_POLICY.md`, `docs/accessibility/ACCESSIBILITY_CONTRACT.md`, and
`STATION-NAVIGATION-MODEL.md` before any lane. Everything below was verified against
repo truth and a live seeded instance (`node frontend/e2e/server.mjs`, token
`ci-token`, `http://127.0.0.1:8731`) on 2026-09-17 — citations included.

---

## 0. Verified baseline (re-run; don't trust these numbers forever)

- `npx playwright test station-a11y station-keyboard station-motion-reflow`
  → **20 passed, 1 skipped** ("KNOWN FINDING: onboarding @390px
  `.onb-body` scrollable-region-focusable — needs Station-side fix",
  `frontend/e2e/station-a11y.spec.ts:102`). Green gate exists and runs.
- Page load (index, authenticated Chromium): **20 requests, 3 API calls**.
  Static assets carry `cache-control: public, max-age=0, must-revalidate` + ETag
  (HTML: `no-store`) — conditional GETs work; repeat loads mostly 304 (this is the
  deliberate no-immutable revalidation contract — keep it). **Verifiably absent:
  compression** — `Accept-Encoding: gzip` on `station.css` returns 71,328 bytes
  with no `Content-Encoding` header.
- ~310 KB uncompressed text per page (`station.css` alone 71 KB / 1612 lines).
- Zero `setInterval`/`requestAnimationFrame` polling in station JS (good).

---

## 1. My take as incoming design lead (the "why" for the lanes)

The product already has a real point of view — the map *is* the IA, plain words on
the surface, machinery one disclosure down, companions as silhouettes. That is worth
protecting. Three highest-leverage bets, in order:

1. **Fix truth leaks before adding charm.** A few specimen blocks still speak in
   first person about the user's life ("you stopped mid-thought 4 days ago") and two
   surfaces run parallel storage tracks (server vs this-browser) without saying so
   where the user types. In this product, coherence *is* the charm.
2. **Spend identity on typography, keep layout quiet.** Palette/space grammar is
   settled. The weak vector is display type: Georgia italic + system sans is
   default-territory for a "cozy station chart". One self-hosted, subsetted display
   face (suggestion: **Fraunces**, variable, italics — old-style warmth, not a neon
   sci-fi cliche) for place-names only; body stays system (perf + familiarity).
   ~30–60 KB woff2, `font-display: swap`, Georgia fallback unchanged.
   **Owner-approved 2026-09-17** under the D5 constraints (restrained use, graceful
   fallback, body/control typography untouched).
3. **Reward = information, not animation.** Depth-0 feels static because it carries
   no real data yet. The sanctioned lever (per contract: static rings, text counts,
   opt-in drift) is *real recency/counts on nodes* plus rare, event-driven,
   reduced-motion-safe micro-celebrations. Ambient motion stays off by default.

---

## 2. Lane A — accessibility defects (P0-first)

| # | Finding (evidence) | Fix | Accept |
|---|---|---|---|
| A1 | **Companion orb is keyboard-inaccessible.** `station.js:94` creates `<a href="chat.html" id="companion-orb">`; `chat.js:294` removes `href` and adds `role="button"` + a `click` listener only. Live probe: never focused in 60 Tab presses; Space does not activate. (§2.2, §7.4; focus-return on Esc also targets a non-focusable node.) | Make the orb a real `<button type="button">` in `station.js` (the no-chat.js fallback is already void — chrome is injected by JS). Keep the "Open the full room ↗" link inside the dock as the path to `chat.html`. Space+Enter open, Esc closes, focus returns. | New e2e: Tab reaches the orb; Space opens dock; Esc returns focus to orb. Existing keyboard suite stays green. |
| A2 | **Mobile map clips nodes.** 390px screenshot: Systems node half-cut at `.sky` right edge (`overflow:hidden` + % scatter + fixed 520px height). The 360px reflow test checks page scroll, not node clipping. | Clamp galaxy scatter x/y into safe bands at narrow widths (or rotate the ellipse vertical under ~520px). Layout change in `starmap.js` point generation, not CSS overrides of DOM order (§5.4). | New e2e at 360/390: every `.node` bounding box fully inside `.sky`; labels readable. |
| A3 | **Known skipped axe finding** — onboarding `.onb-body` scrollable-region-focusable @390px (`station-a11y.spec.ts:102`, currently `test.skip`-recorded). | Station-side fix (keyboard-scrollable region or restructure), then un-skip. | That spec runs and passes. |
| A4 | **Attention-node hover inversion.** `.node` computes `scale(var(--nscale))` (grows with need) but `.node:hover` (`station.css:850` vs `1010`) replaces it with `scale(1.08)` — the neediest node *shrinks* when you reach for it. | Compose: `transform: translate(-50%,-50%) scale(calc(var(--nscale,1) * 1.08))` on hover/focus. | Hover on an attention node never visually shrinks it; screenshot diff in review. |
| A5 | **Dock has no explicit close control** (Esc / orb-click only). §3.2 wants an explicit close affordance pattern (it's required on mobile sheet; desktop drawer deserves the same kindness). | Add a labelled "Close" button in the dock header. | Close button 44px, keyboard-reachable, Esc still works, focus returns to orb. |

---

## 3. Lane B — optimization (server headers, dead code; **no bundler**)

Zero-build vanilla is a strength here. Optimize delivery, don't industrialize.

| # | Finding (evidence) | Fix | Accept |
|---|---|---|---|
| B1 | **No compression.** curl-verified: `Accept-Encoding: gzip` on the 71 KB `station.css` returns full-body 200, no `Content-Encoding`. (Cache validators exist and are deliberate — `max-age=0, must-revalidate` + ETag; repeat loads 304. Do **not** replace this with immutable caching; it is the UAT no-stale-revalidations contract.) | Add Starlette `GZipMiddleware` (or equivalent) to the app factory; leave cache policy exactly as-is. ~–70% on the text payload for one line of middleware. | pytest in the `test_frontend_serving.py` style asserting `content-encoding: gzip` when offered; `uv run pytest --timeout=30` green; e2e unchanged. |
| B2 | **Dead CSS from the Promenade era.** Verified zero live references (non-`_legacy`): `.stroll*`, `.trace*`, `.promenade`, `.signal*`, `.orient*`, `.backstage`, `.env-*`. `.presence`/`.discovery` survive only as comment words. | Delete the dead blocks from `station.css` (≈10–15 KB). Keep `STATION-DOMAIN-MAP.md` honest after the prune. | e2e + screenshots unchanged; file shrinks measurably. |
| B3 | **`.sky::before` declared twice** (`station.css:797` grid overlay and `:951` graticule); the grid overlay never renders. Same-specificity override — exactly the cancellation pattern to avoid. | Decide intentionally: merge both layers into one rule, or drop one. | One `.sky::before`; intended texture visible in screenshot. |
| B4 | **Chat perceived latency.** Send shows static "Working…" (`role="status"`) for the full local-model round trip; no streaming by provider design. | After ~8s, swap a *visual-only* elapsed line ("still working — 12 s") in a node **outside** the live region (never re-announce — §8.2/8.3). No fake typing dots. | Manual check + unit-ish e2e with a stubbed slow `/api/chat`; `stations-chat.spec.ts` stays green. |

Each page still loads the full script set (~9 JS). **Deliberately out of scope** —
same-origin LAN cost is trivial; splitting scripts is complexity for nothing (policy:
prefer boring).

---

## 4. Lane C — easier to understand (truth leaks + IA papercuts)

Touches copy → `station-lang-truth.spec.ts` expectations will need co-updates.

| # | Finding (evidence) | Fix | Accept |
|---|---|---|---|
| C1 | **Two hidden storage tracks on `interests.html`.** "Your interests" = real server list (API-051, read-only; empty state says "Add… through the server's discovery settings") while three hard-coded shelves (Music / AI & local-first / Reading) have **Add ✦ forms writing to browser localStorage** (`pw-interests`) — invisible split at the exact point of typing. Also shelves are hard-coded while the map taxonomy above them is user-malleable. **Owner decision 2026-09-17: shelves become server-backed. One user-visible truth; localStorage may only support draft/cache behavior.** | Wire each shelf's Add to the real write (API-051-add, POST /api/discovery/interests, step-up gate — named in `interests-view.js`), mapping section/type → category. Remove the silent `pw-interests` store as a destination; localStorage may remain only as an explicit draft (visible "draft — not saved to your world yet" state that clears/syncs on successful write). Shelf groupings follow the map's (user-malleable) clusters instead of three hard-coded names. | lang-truth + projects/interests specs updated; a reader can tell, at each form, where data lands ("saved to your world by the server"); no writes land silently in browser storage; decision recorded in `.project/DECISIONS.md`. |
| C2 | **Journal tabs hide the same split.** "Entries" (server API-005 read = genuinely empty) vs "Notes on this device" (localStorage) vs "Write" (→ localStorage). Writing an "entry" lands in device-notes, not the journal. | Rename/relabel tabs in plain words ("Journal — saved by the server" / "Notes — only on this device"), and say the destination inside the Write form itself. | Live check: write → a user can predict where it went before saving. lang-truth updated. |
| C3 | **Specimen copy in first person.** Journal map strip: "RECENTLY · you stopped mid-thought 4 days ago" — specimen-labelled, but first-person past-tense about the user's mind is indistinguishable in shape from real data (Human-Experience test: what does the person *think* happened?). | Specimen voice = clearly illustrative: third person / neutral ("entries would appear here with their real dates"). Never "you did X N days ago" unless true. | lang-truth spec covers the rule; grep finds no first-person specimen strings. |
| C4 | **Settings ("How this feels") is one ~3500px scroll**: comfort prefs + a 9-row authority table in tiny mono + data deletion + companion pick + backup/restore. Three risk levels, no wayfinding. Nav says "Settings", h1 says "How this feels". | Add in-page wayfinding (anchor chips at top, real links, §2.2), keep the authority table inside its `details.tech` pattern (collapsed by default), group data/backup actions under one clearly-labelled section. Align nav label and h1 (recommend nav: "Settings" → keep; h1 → "Settings — how this looks & feels"). | Keyboard-only user can jump to "Back up my world" in ≤2 actions; axe stays clean. |
| C5 | **Duplicate mood pickers on chat.** "Set the mood" cards + identical starter chips in the empty state do the same thing twice. | One picker. Keep the empty-state chips; drop the header row (or vice-versa) — pick per layout, not per habit. | One mood control per mount; tests adjusted. |
| C6 | **"Show me again" vs "Show me my world ✦".** Topbar "Show me again" replays onboarding; the low-demand quiet block has "Show me my world". Two similar labels, unrelated actions, adjacent surfaces. **Owner decision 2026-09-17: the topbar control reads "Show me" by default; "Open again" is reserved for actions that literally reopen previously dismissed content.** | Rename the topbar replay button (`onboarding.js:285`) to "Show me" (it shows the intro; nothing was dismissed). Audit other re-open phrasings against the rule — the chat dock's "Open the full room ↗" is a plain open, untouched. | No ambiguity; lang-truth/onboarding spec copy updated. |
| C7 | **"Shape this map" edits the whole world from every page.** The editor's host carries `data-region` (`index.html:119` = "world", `interests.html:250` = "interests"…), but `shapemap.js` `render()` flattens the **entire** `viewTree()` regardless (`shapemap.js:36-38`); `scope` only feeds the levels-pref key and reset-positions key. On the Interests page you can rename Journal and move Media. Owner direction 2026-09-17: **map editing is relative to the page you're on**. | Scope the editor to the current region: sub-pages edit only that region's subtree (rows, new-cluster parent select, and move select all limited to subtree ids); the whole-tree editor lives only at `data-region="world"` (World page) — that's the one place for cross-region surgery. Intro copy names what you're shaping ("Organise Interests…" vs "Organise the whole map…"). Levels-revealed and Reset-layout keys already scoped — unchanged. | On `interests.html` the editor shows only Interests' clusters; a keyboard-only user cannot touch other regions there; whole-tree editing still works on `index.html`; e2e added for scoping. |

---

## 5. Lane D — fun & rewarding (do AFTER A–C; shares files with A: `station.js` orb, `chat.js`)

| # | Idea (contract-sanctioned) | Guardrails | Accept |
|---|---|---|---|
| D1 | **Rare micro-celebration**: first answered chat of the day / successful backup / a region going from "needs you" → quiet earns one ✦ sparkle beside the companion (≤400ms, event-driven). | `data-motion=on` only; never under `prefers-reduced-motion`; decorative, `aria-hidden`, never announced (§7.5, §8.2); dismissible; rate-limited (≤1/session). | e2e: absent under reduced motion; no aria-live traffic. |
| D2 | **Companion stays in the thread.** AI answers render as faceless bubbles; the greeting vanishes once you talk. Add the silhouette beside AI bubbles; keep the active mood line persistent in the header while set (currently resets on send). | Silhouette `aria-hidden`; mood state visible in text (§1.4). | Screenshot: identity retained mid-conversation. |
| D3 | **Recency on the galaxy map.** As real sources connect, let node data carry "last touched"/counts (already modelled via `ATTN`/info strip) — makes depth-0 alive through *truth*, not motion. | Ring/text redundancy per §1.3/1.4; specimen copy stays neutral (C3). | Real counts render when connected; honest "not known yet" otherwise. |
| D4 | **Generalize the chat empty-state** (orb + greeting + 2 starter chips — the strongest moment in the product) to Journal "Notes" and the Interests shelves: empty = invitation, one next action, per-companion voice. | Zero claims about real data in empty states. | Visual pass + screenshots; lang-truth green. |
| D5 | **Display face — APPROVED 2026-09-17.** Self-host a subsetted Fraunces woff2, used with restraint for place-names and expressive headings (`.cn`, `.si-title`, empty-state greetings), body and all controls unchanged (Avenir Next / system stack), graceful fallback to the existing Georgia italic serif stack. | Self-hosted only (public repo, no third-party calls); subset latin; `font-display: swap`; AA contrast unchanged; fallback metrics close enough that load swap doesn't jolt layout; reduced-motion unaffected. | `station.css` font stacks updated with fallback chain; woff2 checked into `design/opendesign-exploration/station/` (license file alongside); screenshot diff reviewed by owner. |

---

## 6. Orchestration mechanics (repo rules — obey AGENTS.md)

- **One checkout per lane.** `git worktree add ../pw-lane-<x> main` × 4. Never two
  lanes in one directory; never `git add -A`; stage explicit paths (or
  `scripts/safe-commit.sh`).
- **Order/dependencies:** A, B, C can run in parallel (disjoint files except
  `station.css` — B2's prune and A4's hover fix both touch it: sequence B2 → A4 or
  merge both in lane A). **D runs last** (depends on A1's orb element, C's copy).
  Inside lane C, C1 is the heavy item (real write path + step-up UX + retiring the
  localStorage store) — C2–C7 are pure Station-side copy/structure; if two agents
  run lane C, split C1 into its own worktree.
- **Gates, every lane, from repo root:**
  1. `uv run pytest --timeout=30`
  2. `uv run personal-world framework validate --json`
  3. `cd frontend && npm run test:e2e` (full suite, incl. lang-truth after C)
- **Per-item definition of done:** `implement → test → accessibility check →
  security/ownership check → docs`, contract status recorded PASS/FAIL/N/A/UNKNOWN
  (never fabricate UNKNOWN→PASS), then a Final Truth Report in the PR.
- **Do-not-regress:** honest-state copy ("checked just now", verified-not-assumed),
  quiet-when-healthy, the `details.tech` disclosures, 44px floor, teal focus ring,
  `data-motion=off` default, no first-person fake data, `_legacy/` stays archived,
  companion artwork/Mermaid rig/icon library **never regenerated** (AGENTS.md).
- **Owner decisions (recorded 2026-09-17, no longer open questions):**
  C1 → Interests shelves become **server-backed**; localStorage is draft/cache only.
  C6 → topbar reads **"Show me"** by default; **"Open again"** only for literally
  reopening dismissed content. C7 → map editing is **scoped to the page's region**
  (whole-tree surgery lives on the World page). D5 → **Fraunces approved**
  (self-hosted, restrained, fallback preserved, body/control type untouched).

## 7. Verified-in-review evidence index

- Orb keyboard probe: 60 Tabs, never focused; Space no-op (live Chromium, seeded server).
- A11y gate: `20 passed, 1 skipped` (this repo, this commit `96d5f92`).
- Asset headers: authed `curl -D -` on `/station/station.css` —
  `cache-control: public, max-age=0, must-revalidate`, ETag present; **no
  `content-encoding`** with gzip offered (71,328 bytes on the wire).
- Requests-per-load: 20 total / 3 API (performance API probe).
- Mobile clip + dual-track + duplicate-picker + chat-evaporation findings: screenshots
  (`docs/screenshots/*.png` + fresh probes this pass) and source lines cited above.

- Scoped-editing finding (C7): source-read of `shapemap.js` — `data-region` is read
  into `scope` (line 17) but only used for the levels-pref/reset keys; `render()`
  flattens the full `viewTree()` for rows/add/move on every page (lines 36–95).

**NEXT:** all owner decisions recorded (§6). Spin up lanes A/B/C in worktrees; D after A lands.

---

## 8. Width system (added 2026-09-17, owner-requested)

Declared in `station.css` `:root`:
```css
--w-shell:    1180px;   /* outer frame — maps, grids, dashboards */
--w-content:  760px;    /* content column — panels, forms, chat */
--w-prose:    62ch;     /* reading width — paragraphs, ledes, notes */
```

Applied uniformly:
- `.shell-main { max-width: var(--w-shell) }` — maps and dashboards
- `.cv-view`, `.chat-room`, `.interest-section`, backup section → `var(--w-content)`
- All inline lede/map-note `max-width` (was 48ch/60ch/62ch) → `var(--w-prose)`
- `content-views.css`, `real-data.css`, `projects-view.css` prose blocks → `var(--w-prose)`
- Settings backup section: `640px` → `var(--w-content)`
- `--w-prose` prose width is intentionally wider than `--w-content` panel width for comfortable reading

Projects grid (`1.05fr / 1fr`) is a deliberate dashboard layout — unchanged.
Code/technical blocks (66ch–74ch) are intentionally wider — unchanged.
Map stays full `--w-shell` — it's the hero element.
