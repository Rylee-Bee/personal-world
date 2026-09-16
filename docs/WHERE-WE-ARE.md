# Where we are

*Read this if you don't remember. That's okay. Nothing is lost and nothing is
on you. This page is the whole picture in plain words.*

## What this project is
**Project Worlds** — a gentle, private, self-hosted place to keep your thoughts
and your life organized. It looks like a calm star-map ("the systems map") you
drill into, instead of a busy dashboard. It is built to be kind to low-energy
days, sensitive eyes, and foggy heads — and to be installable by anyone with
one command.

## What's true right now
- The **backend is real and running**: login, your world, journal, reminders,
  settings, safe "propose then approve" writes, git reads, encrypted vault.
- The **star-map frontend** is real and pretty: seven constellations, drill-in,
  companions, chat dock, settings, help button.
- Your **own personal data is NOT in here** on purpose. It lives in your
  separate data repo. This repo is the universal product; dev data is disposable
  and wipe-able (`scripts/reset-dev.sh`).
- Everything is **written down**: decisions, vision, and plans live in
  `docs/PRODUCT-VISION-HANDOFF.md`. You never have to re-explain it.

## The decisions you already made (you can stop re-deciding these)
1. Small local brain (Qwen3 1.7B), kept on-task by the CLI + templates.
2. Optional add-ons (media, GitHub, search) yes; notifications later.
3. Multi-user: one box can serve several people.
4. Backups may include the encrypted vault; never plaintext secrets.
5. Deploy locally first (your Bazzite box, Docker Compose).
6. One updates system, not several.
7. Crypto extra: yes; vault fails closed without it.
8. agent-sync optional; Projects still works without it.
9. Universal first; your data later. Setup wizard + your own SSO (Authelia).
10. The star-map IS the frontend. The API is a full "Lego box" for building
    neat things safely.

## What's being built right now (agents are working; you can rest)
- First-run **setup wizard** (no manual tokens ever).
- **SSO login** (OIDC / Authelia).
- Star-map **wired to real data** + a full API manifest (the Lego box).
- **Multi-user** separation of each person's stuff.
- **Tool-calling fix** so the small brain can use the CLI; templates as focus.
- Frontend: onboarding, search, deep-links, mobile, content views.

## What's on you
**Nothing.** Seriously. Rest. When you're back, just say *"where are we?"* and
any agent (or this file) will catch you up in a minute.

## If your head hurts right now
Close the laptop. The work holds itself. It will still be here, exactly where
you left it, and it will be gentler than whatever you're fearing it is.
