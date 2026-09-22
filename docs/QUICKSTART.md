# QUICKSTART — give Project Worlds to anyone
*One command. No config. No computer degree. Written for tired people and disabled people first, everyone else second.*

---

## What this is
Project Worlds is a **gentle, private home for your thoughts and your life**.
It looks like a calm star-map you drift into — not a dashboard, not a feed,
not a wall of red badges. It stays quiet until something genuinely needs you,
and it never tells you how to feel.

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

- **Screen readers:** real landmarks, real headings, real labels. The map has a
  text equivalent for everything; nothing is conveyed by colour or glow alone.
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

*Standing gate, not a todo:* the Station UI is covered by the automated
Playwright gate (`cd frontend && npm run test:e2e`), which boots the real
app with a seeded world and runs the accessibility, honest-state, keyboard,
motion, and reflow suite — including axe with color-contrast enabled (see
`frontend/e2e/station-a11y.spec.ts`). If something fights you, that's
still a bug we want — not your fault.

---

## Where your stuff lives · how to not lose it
- Everything lives in one place on your machine (the `world-data` volume).
- **Back it up encrypted, any time:** the **"Back up my world" button in
  Settings** (step-up gated), or from the command line on a compose
  install:
  `docker compose exec core personal-world worlds backup ~/my-worlds-backup.pwbackup`
  You choose a passphrase; it is never stored anywhere. Keep the
  passphrase somewhere safe.
- Restore on a fresh machine:
  `docker compose exec core personal-world worlds restore <file>` — then
  run the normal first-run setup once (it mints this box's own token;
  your restored world is left byte-identical around it).

---

## Getting help
- In-app: **"Help & quiet mode"** (top-right) is always there; it lowers the
  demands, never judges.
- Docs: `docs/ROADMAP-AND-TODO.md` (what's done/next) ·
  `docs/WORLDS-BACKUP.md` (SOS procedure) ·
  `docs/PRODUCT-VISION-HANDOFF.md` (why it's built this way).

*Soft by default. Deep when you ask. Everyone, at any level, included.*
