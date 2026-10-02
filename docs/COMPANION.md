# Companion in Worlds

> **Status:** WIP (L-companion, spec slice 7) · **Verified:** 2026-10-02 against a fake Companion only · **Canonical for:** how Worlds talks to the private Companion service · **Read this if:** you are wiring Companion into Worlds or changing the panel

**In short:** Companion is a separate private service that owns the conversation. Worlds only proxies to it and shows the answers. Worlds is public, so nothing here names Companion's address, persona, threads or people.

## Setup (in your own config, never in git)

1. Mount Companion's client token for Worlds as a file, and give Worlds its path: `PW_COMPANION_TOKEN_FILE=/run/secrets/<file>`. The token is never in an environment value and never reaches the browser.
2. Add one provider file `worlds/providers/companion.yaml` in your config directory (the address below is a placeholder shape; use your real one):

```yaml
schema_version: 1
id: companion
name: Companion
kind: http
base_url: http://companion.lan.example:7600
auth:
  type: bearer
  secret_ref: file:PW_COMPANION_TOKEN_FILE
network:
  lan: true
```

`file:NAME` is a secret reference: the environment variable NAME holds the PATH of a file whose content is the secret. All calls go through the same confinement as every other provider (deadline, size cap, address checks; the LAN is allowed only because the provider says `lan: true`).

## What Worlds exposes (owner session only)

`POST /api/companion/turn`, `GET /api/companion/threads[/{id}?after=n]`, `GET /api/companion/context?q=`, `GET /api/companion/changes?since=`, `POST/GET/DELETE /api/companion/grants[/{id}]`, `GET /api/companion/health`.

- **Owner only.** An agent token gets 403. A cookie session also needs the CSRF header and an allowed Origin to change anything.
- **Whitelist both ways.** A request is rebuilt from the few fields the spec allows (a turn: `message`, `client_msg_id`, optional `thread_id`, optional `ui_context` with `quiet` and item text only). A response is rebuilt the same way: a stored turn's `context_items` and `context_canaries` are never forwarded.
- **`client_msg_id` is the idempotency key** and is passed through unchanged. Worlds neither retries nor caches.
- **No second chat store.** Nothing is written. Only counts are logged (message length, reply length), never text.
- **Unknown is an answer.** If Companion cannot answer, the reply is `502 {"state":"unknown","text":"Companion isn't answering.","reason":…}` with a fixed reason word; never a made-up reply, never upstream text. "Not set up" is `503`.
- **Worlds never decides a grant.** It forwards a request (always the `stepped` tier, 60 to 3600 seconds, with a reason) and shows the state; approval happens in Project Home.

## The panel

A quiet "Companion" button in the header opens a native modal dialog: a side panel on a desktop, a full-height sheet on a phone. It is not a fifth landmark. It shows the thread and a composer (sends `client_msg_id`; "thinking" is shown locally while a turn is in flight), each reply's withheld lines ("Some things were withheld: …") and level, "What Companion sees" (section counts, items, UNKNOWN lines), and deeper access (state, "Approve it in Project Home" link, check, stop).

`presentation/1` is mapped to a static pose word and an aria-hidden mark only (`ui/src/fd/companion/presentation.ts`); unknown values fall back to the defaults. Nothing animates.
