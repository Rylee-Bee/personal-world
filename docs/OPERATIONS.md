# Operations guide (0.1)

> **Status:** Reference · **Verified:** 2026-09-26 · **Canonical for:** running, deploying, updating and backing up Worlds · **Read this if:** you are operating an instance — local CLI, containers, production deploy, backups, or chat providers.

**In short:** how to run Worlds locally and in containers, sign in with your own SSO, deploy and roll back, and keep data safe. Keep private hostnames, credentials and access procedures in your own private operator docs — this repo carries the portable pattern only.

> **First run on new hardware?** See
> [`docs/OPERATIONS-FIRST-RUN.md`](OPERATIONS-FIRST-RUN.md) — the
> dated 2026-09-09 bring-up record (historical, not a current recipe).

This guide describes the public standalone application. Keep private deployment
hostnames, service inventories, credentials and access procedures in private
operator documentation.

## Local CLI, zero optional providers

From the repository root, install the locked dependencies and initialize a private
local config directory:

```bash
uv sync --frozen --extra test
uv run personal-world --config-dir config.local init
uv run personal-world --config-dir config.local daily
```

Initialization is idempotent and does not overwrite existing configuration.
`config.local/` and `data/` are ignored by Git. Add optional providers only to your
private configuration; use [provider contracts](PROVIDERS.md) as the reference.
The tracked `config/connections.json` is separate from this local configuration.

## Local web API

Generate a unique token into your shell environment, without printing it:

```bash
export PW_API_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
export PW_CONFIG_DIR="$PWD/config.local"
export PW_DATA_DIR="$PWD/data"
uv run uvicorn personal_world.api:create_app --factory --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/`. Protected API requests need the bearer token.
Do not publish tokens in URLs, screenshots, shell transcripts or public issues.
The core rejects protected requests with no configured token and compares supplied
tokens in constant time. Forwarded identity headers do not bypass this check.

The browser also has `/setup` and `/login` entry points.
First-run setup (`POST /api/setup`) is unauthenticated only until the
setup-complete marker exists — it is also loopback-only (a non-loopback
peer gets 403) and rejects repeats with 409 once the marker exists.
`POST /api/chat/test` requires authentication (bearer, browser session,
or the opt-in loopback dev bypass); it has no elevation gate.
See [Architecture](ARCHITECTURE.md) for the
route inventory and the limits of the current extra write check called step-up.
It is not verified SSO/MFA re-authentication.

### Token reconciliation at boot (setup-created tokens survive restarts)

The setup wizard writes the access code it generates to `<data_dir>/.env`.
At boot the app prefers that file over the compose/supplied
`PW_API_TOKEN` environment value when both exist and differ, so the
credential a human created survives a container restart. To return
authority to a rotated compose token, delete `<data_dir>/.env` and
restart — a deliberate, visible act. If the file is unreadable or
carries no `PW_API_TOKEN` line, boot leaves the environment untouched
(it fails toward the deployment token, never toward lockout).
Native Vault needs `uv sync --frozen --extra test --extra crypto` for encrypted
storage in a local install. The Dockerfile already installs the crypto extra.
Without it the vault fails closed — `unlock` reports `unavailable`, no secret is
stored, and status reports encryption unavailable. There is no base64 fallback.

### Frontend serving (rebuild-only since 2026-09-22)

The **React rebuild** is the product frontend, served same-origin at `/`
by `station_ui.app_router` from the staged build
(`src/personal_world/static/app/`, produced by the image's node stage or
`scripts/build-app.sh`). `/login` and `/setup` are server-rendered
(`login_page.py` / `setup_wizard.py`). The retired vanilla Station and
the `/vnext` side-by-side are gone: `/station*` and `/vnext*` only
redirect to `/`.

The former vanilla Station (`design/opendesign-exploration/station/`) and
its `/station` router were retired 2026-09-22: not served, not packaged,
removed from the tree (git history preserves them). Unknown document
paths serve the interface shell (client-side routing owns them); unknown
paths under reserved namespaces (`/api`, `/static`, asset routes) answer
JSON `404`. A stray `PW_FRONTEND`/`PW_STATION_DIST` value in the
environment is inert.

## Sign-in with your own SSO (OIDC)

Local token auth is the built-in default and keeps working unchanged when
OIDC is absent. To sign in through **your own** identity provider
(Authelia, Keycloak, Authentik, Zitadel, …), write `oidc.json` into your
private config directory (`PW_CONFIG_DIR`):

```bash
cp config/oidc.example.json "$PW_CONFIG_DIR/oidc.json"   # then edit it
export OIDC_CLIENT_SECRET='…'                            # never in the file
```

The file holds only non-secret wiring — `issuer`, `client_id`,
`client_secret_env`, `scopes`, `display_name`. The client secret is read
exclusively from the environment variable that `client_secret_env` names,
at request time; it is never stored, logged, or returned by an endpoint.
Register `https://<your-host>/api/auth/oidc/callback` with the provider
(and run uvicorn with `--proxy-headers` behind a reverse proxy, so the
redirect URI matches).

`GET /api/auth/oidc/status` reports the real state:
`not_configured`, `configured`, `unreachable`, or `misconfigured` — plus
provider discovery metadata and the *name* of the secret variable with a
boolean saying whether it is set. It never returns a secret value, and it
caches discovery (success and failure) so an anonymous caller cannot use
it to probe your IdP. Sign-in is authorization-code + PKCE (S256) with a
signed, expiring state cookie; the `id_token` signature is verified
against the provider's JWKS and its `iss`/`aud`/`exp`/`nonce` claims are
validated before the subject is mapped onto a local principal. Tokens are
verified and discarded, never stored.

RS256/384/512 verify with the standard library alone; other algorithms
need the `cryptography` extra (`uv sync --extra crypto`, already present
in the container image). An algorithm this install cannot verify is
refused, not accepted unverified.

Step-up is unchanged by SSO: an OIDC sign-in does not mint a step-up
grant. Full field reference, error codes, provider examples, limits and
troubleshooting: [docs/oidc.md](oidc.md).

## Containers

The provided Compose file is the portable appliance: it pulls the published
GHCR image and persists state in a Docker volume. No source tree, no homelab
checkout, no Kilo auth file, and no WSL paths are required to boot.

```bash
export PW_API_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
docker compose pull
docker compose up -d
docker compose ps
```

Then open `http://127.0.0.1:8000/`. A local-only setup should bind to
`127.0.0.1` instead of `0.0.0.0`; remote use needs TLS, access controls, and a
reviewed authentication setup — these are deployment choices, not defaults in
the tracked Compose.

### Image tags

| Tag | Source | Use |
| --- | --- | --- |
| `ghcr.io/rylee-bee/personal-world:latest` | Each successful main publish | Convenience tag for fresh installs |
| `ghcr.io/rylee-bee/personal-world:sha-<full SHA>` | Same publish | Immutable; preferred for reproducible deploys and rollback |

Pin `latest` for ordinary use. Pin a `sha-...` tag when you need a
reproducible deployment or want to roll back to a known-good image.

### Rollback

```bash
PW_IMAGE=ghcr.io/rylee-bee/personal-world:sha-<known-good> \
    docker compose up -d
```

Or set `PW_IMAGE` in `.env` and `docker compose up -d`. No separate rollback
machinery is needed.

### Local development (build from source)

The portable base only ever pulls. To iterate against the Dockerfile and
the live code without a GHCR push, use the dev override:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

The dev override sets `build: .`, `image: personal-world:dev`, and
`pull_policy: never` — it never reaches GHCR. Developers do not need to
edit the production Compose file.

### Production deployment (the transcode host)

Production Worlds runs on the **transcode host** (a LAN machine) as a
docker compose stack at `/opt/personal-world`, serving the owner's Worlds
hostname through homelab Traefik. The Traefik route applies the `secure`
headers middleware but **no Authelia forward-auth** — Worlds owns its own
auth (bearer token, browser sign-in, optional OIDC used only as an
identity provider). It is not on the workstation and not part of the
homelab compose stacks.

Images are built by the GitHub Actions `publish-image` workflow on `main`
and pushed to `ghcr.io/rylee-bee/personal-world`; production pulls them:

```bash
cd /opt/personal-world
docker compose pull && docker compose up -d
```

Updates are normally one tap: Project Home's "What's live" panel shows the
running vs latest commit and can create an ask-first deploy task. After
approval, the Project Home host deployer (runs every 2 minutes) runs the
app's deploy command — which backs up data, tags the old image
`personal-world:pre-<stamp>` for rollback, pulls, restarts, and waits for
healthy.

Secrets and env live only in `/opt/personal-world/.env` (mode 600):
`PW_API_TOKEN`, `OIDC_CLIENT_SECRET`, and any `PW_ROOM_*_TOKEN` values.
This repo records names only, never values.

### Optional homelab enrichment

The portable base does not bind any host paths. On the homelab developer
host that has the kilo2/homelab checkout and a Kilo auth file, opt in
with the homelab override (read-only binds, no other changes):

```bash
docker compose -f compose.yaml -f compose.homelab.yaml up -d
```

Outside that host, do not use this override. Both bind paths in it are
machine-specific and intentionally non-portable.

## Health, failures and state

`GET /healthz` is a public health endpoint returning
`{"ok", "auth_configured", "setup_needed", "dev_bypass", "commit"}`
(`commit` is the build's short SHA, null when unknown); successful protected API
access is a separate check. The container refuses startup with an empty token.
Docker health status alone does not restart an unhealthy running container.

Unavailable providers must report `unavailable` while core capabilities remain
usable. Missing providers are `not_configured`, not falsely healthy. The daily
loop is on request. A separate reminder scheduler now runs with the API process;
it does not turn the daily loop into a scheduled job.

Back up the data volume securely before deployment changes. It contains world
state, journal, Vault, identities, Apps registry, reminders, and optional per-user
state; deleting it can lose user-authored state and history. `/api/backup` exports
world/journal data only, not a full data-volume backup.
Do not put backups, journal exports or diagnostic dumps in this public repo.

## Chat (optional local AI)

The Chat surface is a provider-neutral conversation over a read-only
world snapshot. With no chat provider configured the capability reports
`not_configured` and every other surface works unchanged; an unreachable
model shows an inline error, never a fake reply.

Wire a provider in your **private** runtime config
(`config.local/connections.json`). The tracked `config/connections.json`
ships only a local-ollama example; never put real endpoints or credentials
in the tracked copy:

```json
{
  "$schema": "personal-world/connections/1",
  "connections": [
    {
      "type": "ollama",
      "name": "local-qwen",
      "capability": "reasoning",
      "base_url": "http://127.0.0.1:11434",
      "model": "qwen3:8b",
      "timeout": 300
    }
  ]
}
```

`type` is `ollama` (Ollama's native `/api/chat`) or `openai_compat` (any
OpenAI-compatible `/v1/chat/completions` endpoint — llama.cpp server,
LiteLLM, vLLM). API keys for remote endpoints use env indirection:
`"api_key_env": "MY_KEY_ENV"` (see the framework secret rule; the
provider never reads the value into settings or exports). `timeout` is
seconds; generous values suit CPU-only inference where a cold 8B model
load can take minutes.

The model observes a trimmed text snapshot of your world (capability
statuses, actors, intents, policies, world-classified lore, recent
journal events, source-repository summaries) plus the last six chat
turns. Private-class lore and secret material are never included.

Read tools execute directly (inspect world status, search journal, check
lab health, etc.). Write requests create bounded proposals that require
approval before execution. Step-up auth gates consequential actions (300s
window). Execution evidence is recorded. The brain does not receive
arbitrary shell access.

## Updates and validation

Fetch and review upstream changes in a clean deployment checkout. Preserve local
config and state; do not overwrite them with repository examples. Review migrations
and take a backup before rebuilding. Never embed repository credentials in images
or remote URLs.

```bash
uv run pytest --timeout=30
uv run personal-world framework validate --json
```

These are local checks. Verify authentication, health, provider behavior and
backup recovery in the actual deployment before treating an update as accepted.
