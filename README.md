# Worlds

![The Worlds crew together — Renai, Ratatoskr, Bolt, the Burrito Journalism truck, and Personal World — in matching uniforms beneath the book-leaf world-tree](design/screens/crew-scene-sept17.png)

> **Status:** Current · **Verified:** 2026-09-26 · **Canonical for:** nothing (the overview; current state is in `.project/CURRENT.md`) · **Read this if:** you are new here, human or agent.

**In short:** Worlds is a private, self-hosted app that shows your life and
your projects in one place: what changed, what needs you, and what can wait.
It runs on your own hardware and never acts without your approval.

## What it is

Worlds is one home screen, **the Bridge**, plus a small set of screens
behind it: **Memory**, **Chat**, **Settings** and **Crew** (and **Interests**,
which is moving out; see Candy below). A guide (the one Assistant voice, or a
companion you choose) briefs you on what changed since you last looked.

Worlds also shows your **rooms**. A *room* is a separate service (your project
workshop, your design studio, your homelab, your discovery feed) that
implements one small shared contract, `room/0`. Worlds shows every room the
same way: its status, its cards, and what needs you. A room that is down is
shown as down, and the other rooms keep working. See
[docs/ROOMS.md](docs/ROOMS.md).

Worlds also defines the **visual design** the other tools use. Its styles are
exported as the framework-free **Worlds kit** (`ui/dist-kit/`), which the other
tools copy in, so they all look the same.

**Your data stays yours; the software around it can change.** Your data stays
on your own hardware and can be exported. This is a **private technical
alpha**: some screens use your real data, some keep data on the device by
design, and unfinished ones are labelled as placeholders and never show fake
data.

> **New here?** Run `./install.sh` and read
> **[docs/QUICKSTART.md](docs/QUICKSTART.md)**: one command, no config,
> written for tired and disabled people first.
> Where things stand: **[docs/WHERE-WE-ARE.md](docs/WHERE-WE-ARE.md)** (plain
> words) and [`.project/CURRENT.md`](.project/CURRENT.md) (for agents).
> Direction: [`.project/PLAN.md`](.project/PLAN.md) (owner-approved
> 2026-09-25; it wins over [TRUE-NORTH](docs/TRUE-NORTH.md) on scope and
> sequencing; TRUE-NORTH's principles on accuracy and accessibility still apply).

## What ships by default

A portable appliance: the core process plus Ollama (`qwen3:1.7b`) and a
one-shot model-bootstrap container, exactly what `compose.yaml` brings up on
`docker compose up -d`. No other containers are required, and no room is
required: rooms are optional services Worlds can show when you run them.

**What uses real data today:**

- **Live today.** The Bridge reads your rooms, briefing and journal (latest
  thread via `GET /api/journal/last`); Memory lists and finds your real journal
  entries and records; Settings and Crew read and write your real
  preferences (voice/tone, companion, keepers, doorways). `/login` and
  `/setup` are server-rendered; **First Light** is the first-run setup.
- **Device-local by design.** Chat conversations stay on the device; replies
  come from your configured model; with no model configured, Chat says `not_configured`.
- **Parked, on purpose.** Projects and systems are labelled placeholders.
- **Moving out.** Discovery, media, calendars and notifications are moving
  to **Candy**, a separate room with its own page. The code is still in
  Worlds today (`src/personal_world/discovery/`, the native providers, the
  Interests screen); nothing has been removed yet.

**10 native providers** (in-process, no extra containers; `ls src/personal_world/providers/native_*.py`):

| Provider | Purpose |
|---|---|
| `native_vault` | Secrets |
| `native_memory` | SQLite FTS5 search |
| `native_calendar` | ICS/CalDAV |
| `native_discovery` | Content discovery |
| `native_reconciler` | Settings validation |
| `native_lab` | Service inventory + health |
| `native_updates` | GitHub releases |
| `native_notifications` | Webhook/ntfy |
| `native_media` | Plex/Sonarr/Radarr/Lidarr |
| `native_deployment` | Docker Compose/systemd |

**Brain Template System:** prompt templates under `config/prompts/` (core,
personas, surfaces, tasks, formats), private overrides via
`config/prompts.local/`, provenance tracking (`ls -R config/prompts`).

**Connections & Providers:** provider wiring is schema-driven and
managed in `config/connections.json`; the in-process natives above
need no configuration at all.

**Brain tools** cover read-only world inspection, media, and
proposal-based writes — every write path needs your approval.

**Auth/SSO:** Native/local auth (`PW_API_TOKEN`), session-cookie support,
OIDC sign-in with any provider (`config/oidc.json`; point it at your own
IdP), step-up auth (300s window), break-glass (`PW_API_TOKEN`
fallback). Which provider a deployment uses is recorded in private
operator documentation, not here.

**Execution Viewer:** Bounded execution evidence with actor, target,
command, timestamps, and exit codes.

**Scheduler:** Background reminder runner, persistent across restarts.

## Architecture

```
Worlds core process
├── native_vault
├── native_memory
├── native_calendar
├── native_discovery
├── native_reconciler
├── native_lab
├── native_updates
├── native_notifications
├── native_media
├── native_deployment
├── journal
├── scheduler
├── tool registry
├── Brain Template System
├── proposal/approval system
└── Execution Viewer

Ollama
└── qwen3:1.7b default bundled brain
```

**One core process with small built-in capabilities, and adapters for outside
services. An external service is added only when it's actually needed.**

Around the core, optional **rooms** run as their own services and are listed
at runtime by a **room registry** (served by Project Home; `PW_ROOMS_REGISTRY_URL`).
Worlds checks each room's contract before showing it, and for per-person
rooms tells the room who is asking (`X-Worlds-Principal`) alongside the room's
own token. Details: [docs/ROOMS.md](docs/ROOMS.md).

## A Play-Nice product

This project adopts [Play-Nice Contracts](.project/contracts/adoption.yaml)
(`Rylee-Bee/play-nice-contracts`) as its shared cooperation and
engineering constitution.

Play-Nice governs how the four sides of Worlds cooperate:
**Rylee** (the owner), **Worlds** (the app), the **agents and models** that
help her, and the **providers, APIs, automation and interfaces** around them.
The rules include: back claims with evidence, make state explicit, ask instead
of guessing, record why consequential decisions were made, make mistakes
recoverable, meet minimum accessibility requirements, keep work bounded, and
cooperate in good faith. These rules govern how the work is done; they are not
product features.

Worlds **accepts and implements** the **full** Play-Nice library (8 layers)
through one manifest:
[`.project/contracts/adoption.yaml`](.project/contracts/adoption.yaml),
pinned to a verified library revision (v0.10.0 as of 2026-09-26, which
includes ROOM 1.1.1). Applicable contracts are resolved per task
from that manifest's `always` and `triggers` lists; no contract text is
copied into this repository. The explicit acknowledgement — target
revision, implemented contracts, and evidence — is in
[`ACKNOWLEDGEMENT.md`](ACKNOWLEDGEMENT.md).

The canonical adoption is at
[`.project/contracts/adoption.yaml`](.project/contracts/adoption.yaml);
canonical current state at [`.project/CURRENT.md`](.project/CURRENT.md);
durable decisions at [`.project/DECISIONS.md`](.project/DECISIONS.md).

## The interface

The product UI is the **React rebuild** (`ui/`), served same-origin at
`/` by the backend. The container image builds it itself (node stage →
`src/personal_world/static/app/`); for a source checkout run
`bash scripts/build-app.sh`. `/login` and `/setup` are server-rendered.
The retired vanilla Station is no longer served or packaged; `/station`
and `/vnext` only redirect to `/`.

Sign-in is **provider-neutral OIDC** — point it at your own IdP
([docs/oidc.md](docs/oidc.md)). With an IdP configured the login page is
**passkey-first**: one "Sign in with …" button, and the access code folds
away as a fallback. The superseded React frontend was removed on
2026-09-16 (single-branch cutover).

### Screenshots

Current screenshots are in the **[screenshot gallery](docs/gallery/README.md)**:
every screen, at phone (390) and desktop (1440) widths, in the default
starfield theme and the others. The Station-era screenshots under
`docs/screenshots/` show the retired server-rendered UI and are kept as
history only.

## Quick start

Requires Python 3.12 or newer and [uv](https://docs.astral.sh/uv/getting-started/installation/).

```bash
git clone https://github.com/Rylee-Bee/personal-world.git
cd personal-world
uv sync --frozen --extra test
uv run personal-world --config-dir config.local init
uv run personal-world --config-dir config.local daily
```

Then serve the hub with a token:

```bash
PW_API_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))") \
PW_CONFIG_DIR=config.local \
uv run uvicorn personal_world.api:create_app --factory --app-dir src --port 8000
```

`data/` and `config.local/` are ignored runtime directories. See
[Operations](docs/OPERATIONS.md) for container setup, tokens, and
network scope.

## Container deployment

```bash
export PW_API_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
docker compose pull
docker compose up -d
```

The portable base image (`compose.yaml`) carries no host paths; it
boots with only the images, a `world-data` volume and an `ollama-data`
model volume, and the token: the core, Ollama, and the one-shot model
bootstrap. Images are published to `ghcr.io/rylee-bee/personal-world` by the
`publish-image` workflow on every push to `main`. See
[Operations](docs/OPERATIONS.md#containers) for deployment, updates and
rollback.

## How the assistant works

The brain receives a trimmed text snapshot of your world (capability
statuses, actors, intents, policies, world-classified lore, recent
journal events, source-repository summaries) plus the last six chat
turns. Private-class lore and secret material are never included.

- Read tools execute directly (inspect world status, search journal,
  check lab health, etc.)
- Write requests create bounded proposals (journal entries, world
  facts/intents, reminders)
- Chat is a real conversation when a model is configured — read-only:
  replies observe your world; no tool execution, no mutations without
  approval. With no model configured, Chat answers `not_configured`.
- Approval is required for all writes
- Step-up auth for consequential actions (300s window)
- Execution evidence is recorded in the Execution Viewer
- The brain does not receive arbitrary shell access

## Deeper documentation

| Interest | Entry point |
|---|---|
| Where things stand (plain words) | [WHERE-WE-ARE.md](docs/WHERE-WE-ARE.md) |
| Architecture | [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Rooms | [ROOMS.md](docs/ROOMS.md) |
| Screenshots | [gallery](docs/gallery/README.md) |
| Native baseline | [NATIVE-BASELINE-AND-ENRICHMENT.md](docs/NATIVE-BASELINE-AND-ENRICHMENT.md) |
| Operations | [OPERATIONS.md](docs/OPERATIONS.md) |
| Providers | [PROVIDERS.md](docs/PROVIDERS.md) |
| Direction | [`.project/PLAN.md`](.project/PLAN.md), then [TRUE-NORTH.md](docs/TRUE-NORTH.md) |
| Finish line detail | [PERSONAL-WORLD-FINISH-LINE.md](docs/PERSONAL-WORLD-FINISH-LINE.md) |
| Design | [Workshop v3 design authority](.project/design/CURRENT.md) |
| Accessibility | [ACCESSIBILITY_CONTRACT.md](docs/accessibility/ACCESSIBILITY_CONTRACT.md) |
| Full docs index | [INDEX.md](docs/INDEX.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Security | [SECURITY.md](SECURITY.md) |

## Validation

```bash
uv run --extra test --extra crypto pytest --timeout=60 -o addopts="" -q
uv run personal-world framework validate --json
cd ui && npx tsc -b && npx vitest run && npm run kit:check
```

Licensed under [Apache-2.0](LICENSE). The project is experimental; see
the [security policy](SECURITY.md) for the current support and
deployment boundary.

![Worlds companion artwork: Mermaid, Personal World, Little Helper robot, world-tree squirrel and the taco news truck, gathered under the world-tree](design/screens/worlds.png)
