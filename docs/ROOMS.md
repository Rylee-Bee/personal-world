# Rooms

> **Status:** Current · **Verified:** 2026-09-26 · **Canonical for:** how Worlds finds, checks and shows rooms (the contract itself is canonical in Play-Nice `ROOM.md`) · **Read this if:** you want to add a room, understand a room's status, or change how Worlds talks to rooms.

**In short:** A room is a separate service (your project workshop, your
design studio, your homelab, your discovery feed) that answers five small
web endpoints. Worlds asks every room the same questions and shows the
answers the same way: status in words, cards, and what needs you. A room
that is down shows as down; it never breaks the rest.

## What a room is

A **room** is any service that serves the Play-Nice ROOM contract
`room/0`. Worlds never copies a room's code and never runs it; it only calls
the room over HTTP.

The five endpoints (canonical text: Play-Nice
`contracts/interfaces/ROOM.md`, pinned in
[`.project/contracts/adoption.yaml`](../.project/contracts/adoption.yaml)):

| Endpoint | What it answers |
|---|---|
| `GET /room` | Who the room is: `contract`, `id`, `name`, `icon`, `version`, `commit`, `status` (`healthy`, `degraded`, `unhealthy`, `unknown`), `updated_at` |
| `GET /room/cards` | Things to show. Each card has a `tone` (`good_news`, `update`, `when_ready`), an optional `link`, and `freshness.observed_at` (the item's own time, never the request time) |
| `GET /room/needs-you` | Things that need a person, each with a plain-words `why` and an optional `link` |
| `GET /room/actions` | What the room can do, with `default_autonomy` (`auto`, `check_in`, `ask_first`) |
| `POST /room/actions/{id}` | Do it. Always returns a receipt (`ok`, `summary`, `changed`, `at`); needs an `Idempotency-Key` so a retry never runs twice |

Tone is a display hint, never a priority. Urgency lives in needs-you.

## The rooms today

| Room id | What it is | Where it runs |
|---|---|---|
| `workshop` | Project Home: tasks, approvals, what's live, secrets | the workstation |
| `studio` | Designs, demos, screenshots and themes | the workstation |
| `engine-room` | The homelab's health (`lab room serve` in the homelab repo) | the workstation |
| `candy` | Discovery (books, music, shows, releases); per person | a container on the workstation |

Source of truth for the live list: the room registry (below), not this table.

## How Worlds finds rooms: the registry

Worlds reads its room list at runtime, so adding or removing a room needs
no Worlds restart.

- `PW_ROOMS_REGISTRY_URL` names Project Home's `GET /api/rooms/registry`.
- `PW_ROOMS_REGISTRY_TOKEN_ENV` names the env var holding the bearer token
  for that call (the value is never logged or returned).
- `PW_ROOMS_REGISTRY_INSECURE_TLS=1` accepts a self-signed certificate on a
  LAN address.
- The registry answer is cached for 60 s (`REGISTRY_CACHE_TTL_SECONDS`) and
  saved as last-known-good in `rooms-registry.json` under the data dir. If the
  registry can't be reached, Worlds uses the last-known-good and says so.
- Only if there has never been a registry answer does Worlds fall back to the
  static `PW_ROOMS` list (`id=baseURL,id=baseURL`).

Each registry row has: `id`, `name`, `base_url`, `public_url`, `contract`,
`token_env`, `insecure_tls`, `forward_principal`, `enabled`.

- `token_env` is the **name** of the env var in Worlds' environment that holds
  that room's token. It must match `^PW_ROOM_[A-Z0-9_]+_TOKEN$`, so a registry
  can never point Worlds at an unrelated secret such as `PW_API_TOKEN`.
- `public_url` is the address a browser can reach; Worlds uses it for Open,
  Review and Back to, and falls back to `base_url`.
- `enabled: false` keeps the room listed but not shown.

Code: `src/personal_world/rooms.py` (`RoomsService`, `_parse_registry_entries`).

## How Worlds checks and shows a room

- **Compatibility first.** A room whose `contract` is not in
  `SUPPORTED_CONTRACTS` (`room/0`) shows as **incompatible**, with the reason;
  its cards and needs are never counted.
- **Honest status.** A room that can't be reached, times out (2 s,
  `TIMEOUT_SECONDS`) or answers malformed JSON shows as **unreachable** with
  when it was last seen. `unknown` is not `healthy` and not failed.
- **One snapshot for everyone,** cached 15 s (`CACHE_TTL_SECONDS`), except the
  per-person parts below.
- **Links open on the room's own site,** in a new tab. There is no proxy:
  serving rooms from Worlds' own address would hand every room Worlds'
  cookies. A need or card `link` must be a same-origin path (`/tasks/2`), never
  `//host` or `https://…`.

## Per-person rooms

Some rooms keep separate data for each person (Candy does). For those, the
registry row sets `forward_principal: true`.

- Worlds then sends `X-Worlds-Principal: <principal id>` on every call to
  that room, **in addition to** the room's own bearer token, never instead of
  it. A room with no token configured never gets the header.
- Cards and needs for that room are fetched and cached per person (15 s, at
  most 64 people, `MAX_FORWARD_PRINCIPALS`). Health stays shared: a room that
  is down is down for everyone.
- One person's cards never appear in another person's answer. If a person's
  own fetch fails, they see empty cards with the error, not anyone else's.
- Background jobs (digest, briefing without a caller) send no principal, so
  the room answers with its default, non-personal view.
- Worlds never forwards the human's session token or `PW_API_TOKEN` to a room.

## What Worlds keeps per person

These belong to Worlds, not to the room, and are stored per principal:

| Route | What it does |
|---|---|
| `GET /api/rooms` | Every room's row, plus the caller's `last_visited_at`, `needs_seen`, `changed_since_visit`, `keeper` and `doorway` |
| `POST /api/rooms/{room_id}/visit` | Record that the caller visited (and where they were) |
| `POST /api/rooms/{room_id}/needs/{need_id}/seen` | Mark a need as seen by the caller |
| `PUT /api/rooms/{room_id}/keeper` | Put a crew member on the room (or clear it) |
| `PUT /api/rooms/{room_id}/doorway` | Choose the room's doorway picture from the closed list (or clear it) |

Keepers and doorways never change a room's status. Defaults: `workshop`
starts with Bolt as keeper; every other room starts with no keeper and no
doorway.

## Secrets in the Workshop room

The Workshop room's drawer has a read-only **Secrets** section:
`GET /api/secrets/overview` reads Project Home's `GET /api/secrets/summary`
with the workshop room's token. It shows station health, key **names**
grouped by namespace, pending requests and recent changes. It never shows a
value, and it is **admin only** (other household members get 403). Values
are typed only on Project Home's own trusted page.

## Adding a room

1. Build the service so it answers the five endpoints with the shapes above.
   Require a bearer token for anything personal; refuse to listen beyond
   loopback without one.
2. Put the token value in Worlds' environment under a name like
   `PW_ROOM_<ID>_TOKEN` (production: the host's `.env`, mode 600). Never in git.
3. Add a row to the registry file on the Project Home host (`rooms.json`) with
   `token_env` set to that name, `contract: "room/0"`, and `enabled: true`.
   Add `forward_principal: true` only if the room keeps per-person data.
4. Restart Worlds only if you changed its environment (step 2). Registry
   changes are picked up within about a minute. On the Project Home side, the
   registry is served through its host connector, so restart that connector
   after upgrading Project Home's registry code.
5. Check `GET /api/rooms`: the row should be reachable and not incompatible.

## Troubleshooting

| You see | It means | Do this |
|---|---|---|
| `unreachable` | Worlds couldn't reach the room in 2 s | Check the room is running and its `base_url` |
| `incompatible` | The room's `contract` isn't `room/0` | Upgrade the room or Worlds; the reason is in the row |
| `unknown` | The room itself can't verify its state yet | Normal for a new room; look at its needs |
| A room missing | Not in the registry, or `enabled: false` | Check the registry row |
| 401 in the room's logs | Wrong or missing token | Check `token_env` names a variable Worlds actually has |
