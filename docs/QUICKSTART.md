# QUICKSTART — give Project Worlds to anyone
*One command. No config. No computer degree. Written for tired people and disabled people first, everyone else second.*

---

## What this is
Project Worlds is a **gentle, private home for your thoughts and your life**.
It looks like a calm star-map you drift into — not a dashboard, not a feed,
not a wall of red badges. It stays quiet until something genuinely needs you,
and it never tells you how to feel.

It runs on **your own machine** (or a friend's server). Your data stays yours.

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

*Still being hardened:* automated axe/e2e gates for the star-map UI are on the
todo list, so a few edges may still need polish. If something fights you, that's
a bug we want — not your fault.

---

## Where your stuff lives · how to not lose it
- Everything lives in one place on your machine (the `world-data` volume).
- **Back it up encrypted, any time:**
  `personal-world worlds backup ~/my-worlds-backup.pwb`
  (or the "Back up my world" button in Settings). You choose a passphrase;
  it is never stored anywhere. Keep the passphrase somewhere safe.
- Restore on a fresh machine: `personal-world worlds restore <file>`.

---

## Getting help
- In-app: **"Hail Assistant"** (top-right) is always there; it lowers the
  demands, never judges.
- Docs: `docs/ROADMAP-AND-TODO.md` (what's done/next) ·
  `docs/WORLDS-BACKUP.md` (SOS procedure) ·
  `docs/PRODUCT-VISION-HANDOFF.md` (why it's built this way).

*Soft by default. Deep when you ask. Everyone, at any level, included.*
