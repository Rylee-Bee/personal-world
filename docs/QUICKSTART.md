# QUICKSTART — give Worlds to anyone

> **Status:** Current · **Verified:** 2026-09-26 · **Canonical for:** installing and first-running Worlds · **Read this if:** you want to run Worlds on your own machine, or you need the plain-language on-ramp.

**In short:** one command installs Worlds and a setup wizard walks you
through the rest in plain words. No config files, no pasted tokens, no
computer degree — this page is written for tired people and disabled
people first.

---

## What this is
Worlds is a **gentle, private home for your thoughts and your life**.
It opens on a calm home screen (the **Bridge**) with Memory, Chat and
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
- **Honesty:** it never fakes data, never hides errors, and always tells you
  what's real vs. not-set-up-yet.

*Standing gate, not a todo:* the interface is covered by the automated
Playwright gate (`cd ui && npx playwright test`), which boots the real
app with a seeded world and runs the accessibility, honest-state, keyboard,
motion, and reflow suite — including axe with color-contrast enabled (see
`ui/e2e/accessibility.spec.ts` and `ui/e2e/axe.spec.ts`). If something fights you, that's
still a bug we want — not your fault.

---

## Where your stuff lives · how to not lose it
- Everything lives in one place on your machine (the `world-data` volume).
- **Back it up encrypted, any time,** from the command line on a compose
  install:
  `docker compose exec core personal-world worlds backup ~/my-worlds-backup.pwbackup`
  You choose a passphrase; it is never stored anywhere. Keep the
  passphrase somewhere safe. (There is no in-app backup button today;
  see `docs/RECOVERY-BOUNDARY.md` for what a backup actually restores.)
- Restore on a fresh machine:
  `docker compose exec core personal-world worlds restore <file>` — then
  run the normal first-run setup once (it mints this box's own token;
  your restored world is left byte-identical around it).

---

## Getting help
- Docs: `docs/INDEX.md` (the full map of the documentation) ·
  `docs/WORLDS-BACKUP.md` and `docs/RECOVERY-BOUNDARY.md` (backup and SOS) ·
  `.project/CURRENT.md` (where the project actually is) ·
  `docs/accessibility/ACCESSIBILITY_CONTRACT.md` (the accessibility floor).

*Soft by default. Deep when you ask. Everyone, at any level, included.*
