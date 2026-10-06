# QUICKSTART — give Worlds to anyone

> **Superseded in part by [ADR-0008](adr/0008-front-door.md) (2026-10-01):** the Worlds interface was replaced by the front door (`ui/src/fd`: Home · Connect · Memory · Settings). Screen, component, route and test names in this document describe the old interface; read them as history. The current map is [FRONTEND-INVENTORY.md](../FRONTEND-INVENTORY.md).

> **Status:** Current · **Verified:** 2026-09-26 · **Canonical for:** installing and first-running Worlds · **Read this if:** you want to run Worlds on your own machine, or you need the plain-language on-ramp.

**In short:** one command installs Worlds and a setup wizard walks you
through the rest in plain words. No config files, no pasted tokens, no
computer degree — this page is written for tired people and disabled
people first.

---

## What this is
Worlds is a **gentle, private home for your thoughts and your life**.
It opens on a simple home screen (the **Bridge**) with Memory, Chat and
Settings a tap away — not a dashboard, not a feed, not a wall of red
badges. It stays quiet until something genuinely needs you, and it never
tells you how to feel.

It runs on **your own machine** — or on a server you reach over SSH:
setup writes are loopback-only by design, so on a remote box open an
SSH tunnel first (`ssh -L 8000:127.0.0.1:8000 you@server`) and use
`http://127.0.0.1:8000/` locally. Your data stays yours.

---

## The one command
You need **podman or docker** installed. That's the only prerequisite.

```bash
git clone https://github.com/Rylee-Bee/personal-world
cd personal-world
./install.sh
```

Then open **http://127.0.0.1:8000/** and the **setup wizard** walks you through
the rest in plain words. It provisions everything invisibly — you never paste a
token or edit a config file. You can sign in "just me on this device"
(zero-config) or with **your own SSO** (Authelia, Keycloak, anything OIDC).

Re-running `./install.sh` is safe. It never deletes your data.

---

## If you're disabled, low-energy, or use assistive tech
This was built for you first. Here's what's true:

- **Screen readers:** real landmarks, real headings, real labels. Every
  surface has a text equivalent for everything; nothing is conveyed by
  colour or glow alone.
- **Keyboard & switch access:** everything is reachable and operable by keyboard;
  visible focus rings always; no hover-only or drag-only interactions.
- **Low vision:** AA contrast by default, a high-contrast presentation available,
  and it reflows cleanly at 200% zoom and on small screens.
- **Sensory safety / migraine:** low-glare palette, no flashing, no parallax.
  Motion is **off by default**; your OS "reduce motion" setting always wins.
- **Low-energy / foggy days:** "low-demand mode" keeps your whole world intact
  but asks less of you. "Nothing needs your attention" is a real, respected
  state — not a guilt trip.
- **Big targets:** every interactive thing is at least 44×44px.
- **Accuracy:** it never fakes data, never hides errors, and always tells you
  what's real vs. not-set-up-yet.

*Standing gate, not a todo:* the interface is covered by the automated
Playwright gate (`cd ui && npx playwright test`), which boots the real
app with a seeded world and runs the accessibility, accurate-state, keyboard,
motion, and reflow suite — including axe with color-contrast enabled (see
`ui/e2e/accessibility.spec.ts` and `ui/e2e/axe.spec.ts`). If something fights you, that's
still a bug we want — not your fault.

---

## Where your stuff lives · how to not lose it
- Durable state lives in two places on your machine: the config files under
  `$PW_CONFIG_DIR` and the Memory database `$PW_DATA_DIR/worlds.db` (on a
  Compose install these are the config and data volumes). The cache is
  disposable.
- **Back up Memory any time** through the app's own route:
  `POST /api/memory/backup` writes a dated `worlds-*.db` copy under
  `$PW_DATA_DIR/backups/` with SQLite's online backup API. It is not encrypted
  by the app, so keep the copy as private as the database itself.
- **Restore** on a fresh machine: stop Worlds, then
  `python -c "from personal_world.worlds.memory_store import restore_backup; print(restore_backup('<backup file>', '<data dir>'))"`,
  and start Worlds again. It refuses a directory that already holds Memory, so
  it never overwrites.
- The full durability contract — what survives, what to back up, how to
  restore — is `docs/rebuild/DURABILITY.md`. The measured drill is
  `scripts/restore-drill.sh`.

---

## Getting help
- Docs: `docs/INDEX.md` (the full map of the documentation) ·
  `docs/rebuild/DURABILITY.md` (what to back up and how to restore) ·
  `.project/CURRENT.md` (where the project actually is) ·
  `docs/accessibility/ACCESSIBILITY_CONTRACT.md` (the minimum accessibility requirements).

*Soft by default. Deep when you ask. Everyone, at any level, included.*
