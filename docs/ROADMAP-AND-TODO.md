# PROJECT WORLDS — THE EASY ROADMAP & TODO
*The whole journey on one page. ✅ done · 🛠️ happening now · ⏳ waiting (mostly on nothing) · ⏸️ later on purpose.*
*Updated 2026-09-16. If you only read one thing today, read "Where we are" and "Needs you."*

---

## Where we are (the short version)

**Phases 0–2 are DONE. Phase 3 is nearly done. Phase 4 waits on you only if you want.
Phase 5 is later on purpose.** You are not at the beginning. You are at the
"finish the packaging and taste it" stage.

```
Phase 0  the dream & the rules      ██████████  ✅
Phase 1  a real backend             ██████████  ✅
Phase 2  a gentle, beautiful front  █████████░  ✅ (real-data wiring finishing)
Phase 3  anyone-can-install runtime ████████░░  🛠️
Phase 4  make it YOURS              ██░░░░░░░░  ⏳ (optional, on your good days)
Phase 5  shareable & lasting        ░░░░░░░░░░  ⏸️ (later, by choice)
```

---

## Phase 0 — The dream & the rules ✅
*What you wanted, in your words:*
- [x] "a place to keep my thoughts and life organized" that is **gentle**
- [x] "quiet when healthy" — it never nags; silence means verified-ok
- [x] "low-demand mode" for bad days; never tells you how to feel
- [x] accessible for **everyone at any level** (44px targets, contrast, keyboard, reduced-motion)
- [x] a **star-map** you drift into, not a dashboard or a wall of screens
- [x] companions as soft presences (Mermaid, Ratatoskr, Robot, Burrito), never bosses
- [x] your **Play Nice contracts** as the law every builder must follow
- [x] the **DNA** written down: smallest-reliable-first · depth on demand · soft by default · everyone included
- [x] all 21 decisions recorded so nobody (including you) has to re-decide them

## Phase 1 — A real backend ✅
- [x] login / sessions / step-up approval (auth that fails closed)
- [x] your world, journal (+search), reminders, preferences — durable stores
- [x] safe changes: propose → approve → act (nothing writes itself)
- [x] encrypted vault that refuses to run unsafe
- [x] git/source-control reads; homelab **lab** providers (your ported CLI)
- [x] **multi-user**: each person's stuff stays theirs (379 tests)
- [x] **small brain on-task**: one chat loop + lenient tool-calling + templates (ORPH-03 fixed; 42+172 tests)
- [x] **sign-in with your own SSO** (generic OIDC, Authelia-ready; 96 tests, stub-verified)
- [x] **first-run setup wizard** — invisible provisioning, no token pasting (23 tests)
- [x] **API = Lego box**: every capability exposed, reads open, writes gated, `/api/manifest`
- [] test OIDC against your *real* Authelia (needs your Authelia URL; wizard will walk you)
- [ ] streaming chat + saved chat history (known gap, deliberately later)

## Phase 2 — A gentle, beautiful frontend ✅ (wiring finishing)
- [x] the systems map: seven little worlds, drill-in, icon planets, orbit rings
- [x] content views: Journal entries · Discoveries · GitHub-like Projects (all honest states)
- [x] onboarding · search (Ctrl/Cmd+K) · deep-links · mobile
- [x] chat dock + templates-as-personality · settings · "Hail Assistant" · low-demand
- [🛠] map shows **real data** instead of samples (api.js + live layer; agent finishing)
- [ ] automatic accessibility tests (axe/e2e) for the Station, so kindness can't regress

## Phase 3 — Anyone-can-install runtime 🛠️
- [x] Docker image now **includes the Station** (so `/station/` works in a container)
- [x] dev compose builds **only from current source** (a stale published image can't win)
- [x] `scripts/dev.sh` — `up` (newest build) · `newest` · `wipe` (safe) · `status` · `logs`
- [x] stopped the stale dev servers cluttering your box (5173 / 5180 / 9123)
- [x] dev auth bypass exists and is **loopback-only** (never trusts the LAN)
- [🛠] rebuild + verify `/station/` served by the backend on your Bazzite box
- [x] retired the old `:8090` static server; `/station/` is served same-origin by the backend (`scripts/dev.sh up`)
- [x] committed + pushed everyone's verified work; repo consolidated to a single `main` (older branches archived as annotated tags)
- [ ] clean first-run test on a fresh box (compose up → wizard → signed in → map)

## Phase 4 — Make it YOURS ⏳ (only on your good days)
- [ ] point OIDC at your Authelia (the wizard asks in plain words; secret stays in an env var)
- [ ] taste-pass: open it and ask "does this feel like mine?" (~30 min)
- [ ] optional add-on secrets (media / GitHub / ntfy) via Vault — only if/when you want them

## Phase 5 — Shareable & lasting ⏸️ (later, by choice)
- [ ] multi-device sync (research first; keep it easy)
- [ ] built-in updates for theme packs / templates / companions / interests (vision #21)
- [ ] homelab lab expansion (only when you care)
- [ ] notifications (ntfy/webhook)
- [ ] public deployment — **only if you explicitly choose it**

---

## Needs you
**Right now: nothing.** Later, optionally: Authelia details · the taste-pass · optional secrets.
Everything else is assembly + verification that runs without you.

## What "done" looks like
```
scripts/dev.sh up          # or: podman compose -f compose.yaml -f compose.dev.yaml up -d --build
→  http://127.0.0.1:8000/station/     cute Station, real data, your login
→  /api/...  /setup  /auth            one backend, one source of truth
```
No mystery old backend. No old React page winning. No `:8090` needed. Boring, on purpose.

---

*If your head hurts: read only "Where we are" and "Needs you." That's the whole truth today.*
