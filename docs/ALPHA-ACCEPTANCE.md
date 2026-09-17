# Alpha acceptance runbook — declaring PRIVATE technical alpha

*Owner checklist for the decision to declare **READY-FOR-PRIVATE-TECHNICAL-ALPHA**.
Every checkbox is ticked in the owner's private operator documentation — this
repository carries the procedure, never the evidence or the topology.
All hosts in examples are `…example.invalid` placeholders; substitute your
own private values outside this repository.*

> **Guardrail — what this document does NOT authorize.**
> Nothing in this runbook authorizes live deployment changes, secret access,
> DNS changes, or any public announcement. It records *how the owner
> verifies* an existing deployment. **Exposure is the owner's decision alone**:
> declaring private technical alpha does not decide reachability. Declaring a
> **public / internet-facing** alpha is explicitly out of scope and requires
> its own security review before it happens.

Evidence convention: each item says **where to record** — a private operator
log outside the public repo (your private infra/docs area). Never paste
URLs, tokens, hostnames, or outputs containing topology here.

## Contents

1. [ALPHA STATUS outcome](#alpha-status-outcome)
2. [1. Immutable image](#1-immutable-image)
3. [2. Ingress, TLS, sign-in and break-glass](#2-ingress-tls-sign-in-and-break-glass)
4. [3. Backup and restore drill](#3-backup-and-restore-drill)
5. [4. Network exposure decision](#4-network-exposure-decision)
6. [5. CI validation and image publish](#5-ci-validation-and-image-publish)
7. [6. Accessibility smoke pass](#6-accessibility-smoke-pass)

---

## ALPHA STATUS outcome

This checklist has exactly two outcomes. Do not invent middle states.

- **READY-FOR-PRIVATE-TECHNICAL-ALPHA** — every checkbox in sections 1–6 is
  ticked with recorded evidence in the private operator log, dated on or
  after the deployment in question. Private technical alpha means: the
  operator and explicitly invited people only, at the exposure level the
  owner has decided (see section 4). Record the exact image tag, the date,
  and the evidence file names in the private log.
- **NOT READY** — any checkbox is unticked, its evidence is missing, or the
  evidence contradicts the pass criteria. Record *which* item failed and the
  exact observed state in the private operator log; do not announce or
  widen access. Fix or consciously defer, then re-run the failed items.

---

## 1. Immutable image

The deployment must run an intended, immutable `sha-` image — the tag CI
publishes for each validated `main` commit (see `docs/OPERATIONS.md`,
"Image tags").

- [ ] **How to verify:**
  ```bash
  docker inspect "$(docker compose images --quiet core)" \
    --format '{{.RepoTags}} {{.Config.Labels["org.opencontainers.image.revision"]}}'
  # and confirm the compose pin matches what you intended:
  grep -E '^PW_IMAGE|^image:' .env compose.yaml
  ```
  Evidence to record (private operator log): the full `sha-<40-char>` tag,
  the `org.opencontainers.image.revision` label (must equal the sha in the
  tag), and whether the tag came from the `publish-image` workflow.
  **Pass:** the image tag is `ghcr.io/…/personal-world:sha-<full commit sha>`,
  pinned (not `latest`), and the running compose config resolves to it
  (`docker compose config` shows no unpinned override). `latest` is a
  convenience tag for fresh installs — acceptable to *pull*, but the
  acceptance run pins a sha tag so rollback has a handle.

## 2. Ingress, TLS, sign-in and break-glass

Follow the generic proxy pattern in [`docs/INGRESS-AND-TLS.md`](INGRESS-AND-TLS.md)
and the OIDC operational truth in [`docs/oidc.md`](oidc.md). Substitute your
own host (`worlds-private.example.invalid`) — record real values only in
private operator docs.

- [ ] **HTTPS/TLS.** How: `curl -sI https://<worlds-host>/healthz` from a
  LAN client — 200 with a valid certificate (your existing reverse proxy
  terminates TLS; the app needs `--proxy-headers`, already in the image).
  Record: the URL shape, cert issuer class (public CA / internal CA), date.
  Pass: TLS chain validates; the session cookie is `Secure` (check in the
  browser's dev tools after sign-in).
- [ ] **`/healthz` honest state.** How: `curl -s https://<worlds-host>/healthz`
  — public liveness + `auth_configured`. Record: response summary, date.
  Pass: HTTP 200 with `auth_configured: true`; `setup_needed` matches what
  you expect for this deployment.
- [ ] **First-run setup closed.** How:
  `curl -s https://<worlds-host>/api/setup/status` — the wizard answers 404
  once `data/setup-complete` exists (see
  `src/personal_world/setup_wizard.py`). Record: HTTP code + date.
  Pass: on an established deployment the setup routes are 404 — completed
  setup is closed, never re-runnable.
- [ ] **OIDC / passkey sign-in.** How:
  `curl -s https://<worlds-host>/api/auth/oidc/status` → expect
  `configured` with `login_available: true` (it reports names and booleans,
  never secret values). Then sign in once in a browser at
  `https://<worlds-host>/login` with your provider (passkey satisfies a
  `one_factor` policy). Record: status response summary (redact issuer if
  it is private), sign-in date, resulting page (`/` → `/station/`).
  Pass: full round-trip succeeds and the session cookie survives a
  container restart.
- [ ] **Logout.** How: sign out from the app
  (`POST /api/auth/logout`, or `GET /api/auth/oidc/logout` which also ends
  the provider session when it advertises `end_session_endpoint`).
  Record: date; whether the provider end-session screen appeared.
  Pass: local session ends; a subsequent protected request is refused;
  landing goes to `/login`.
- [ ] **Local-token break-glass.** How: with OIDC deliberately unreachable
  (e.g. stop briefly, or a canary issuer), sign in at `/login` with the
  instance token — the same credential the bootstrap token or the
  setup wizard created (`PW_API_TOKEN`; the setup-created value lives in
  `<data_dir>/.env` and is preferred at boot). Record: date, that recovery
  worked, and which token source resolved.
  Pass: a working provider outage does **not** lock you out; the local
  session it mints is the same session kind OIDC produces (one session
  model). Then re-prove normal OIDC sign-in recovers.

## 3. Backup and restore drill

State lives in the docker volume `world-data` (known-good copy ⇒ restore),
plus the app-level encrypted archive path (`docs/WORLDS-BACKUP.md`).
`/api/backup` is *not* a full-volume backup — do not treat it as one.

- [ ] **Backup (volume copy).** How:
  ```bash
  docker run --rm -v "personal-world_world-data":/from -v "$PWD":/to \
    alpine tar czf /to/world-data-backup.tar.gz -C /from .
  ```
  (adjust the volume/project prefix to what `docker volume ls` shows for
  this deployment). Record (private log): archive path *outside both* the
  machine and this repo, size, date, and the passphrase location if you
  also ran the encrypted CLI archive.
- [ ] **`worlds backup` encrypted archive** (optional but recommended).
  How: `personal-world --data-dir <data> --config-dir <config> worlds
  backup <private-path>/world.pwbackup` (`--include-vault` for disaster
  recovery). Pass: header manifests the boundary you expect; passphrase
  stored separately from the file.
- [ ] **Restore from a copy — the drill.** How (stop → restore → start →
  verify):
  ```bash
  docker compose stop core
  docker volume ls            # confirm the exact volume name first
  docker run --rm -v "personal-world_world-data":/target -v "$PWD":/from \
    alpine sh -c "tar xzf /from/world-data-backup.tar.gz -C /target \
    --exclude 'sessions.json' --exclude 'memory.fts5.db*'"
  docker compose start core
  curl -s https://<worlds-host>/healthz          # 200, auth_configured
  ```
  Then verify data presence: journal shows pre-backup entries, reminder
  list matches, vault reports its own status, sign-in still works.
  Record (private log): restore date, what was verified present, and any
  `refused[]`/`skipped[]` report rows if you used the CLI restore.
  **Pass:** after a restore from the copied volume, the world state is
  indistinguishable from the pre-backup deployment and health is honest.
  Do the drill on the live deployment only if you accept the risk — a
  scratch deployment on the copied volume satisfies the requirement with
  zero live risk.
- [ ] **The encrypted restore knows its passphrase** — an archive whose
  passphrase is lost is not a backup (`docs/WORLDS-BACKUP.md`: no recovery
  mechanism exists, deliberately). Pass: you can actually open it.

## 4. Network exposure decision

The owner decides; no release document decides it. Reference the
internal-only pattern of `docs/INGRESS-AND-TLS.md` (generic, no topology
here).

- [ ] **Exposure intent is written down.** In the private operator log,
  record the chosen posture: **LAN/VPN-only** (default recommendation for
  technical alpha) or **internet-reachable**, and *which interface* the
  reverse proxy publishes.
  Pass: one of the two postures is chosen explicitly, with the reasoning
  and date recorded privately.
- [ ] **Posture enforced.** How: from outside the intended boundary
  (a different network / offline curl), `https://<worlds-host>` must be
  unreachable *or* reach only the proxy you own. The proxy port is
  firewall-restricted or the entryPoint is not published externally.
  Record: test method + date.
  **Pass:** nothing outside the chosen boundary reaches the app.
- [ ] **No double-auth surprise.** How: sign in once at the app. The app
  brings its own session/OIDC auth; no forward-auth chain sits in front
  unless deliberately configured (and then the proxy URL is an extra OIDC
  redirect target). Record: date, observed number of sign-in prompts.
  Pass: exactly one sign-in appears in normal use, and if a second layer
  exists it is a documented, deliberate deployment choice.
- [ ] **Proxy forwards correctly.** How: the `Secure` cookie persists and
  `/api/auth/oidc/callback` round-trips (`X-Forwarded-Proto` is set).
  Pass: no login bounce loop.

## 5. CI validation, image publish and browser gates

The tracked CI (`validate` workflow) runs pytest, compose config +
image build, the Playwright Station suite (real server, axe with
color-contrast enabled), security gates, and framework conformance.
`publish-image` only fires after `validate` succeeds on `main`.

- [ ] **Latest `validate` run is green** on the commit the deployed image
  was built from. How:
  ```bash
  gh run list --workflow validate --limit 3 --json displayTitle,conclusion,headSha
  ```
  Record (private log): run ID, head sha, conclusion, date. Conclusions are
  CI metadata — fine to record outside the repo; keep no private values in
  the public-side commands.
  Pass: conclusion `success` and headSha equals the
  `org.opencontainers.image.revision` from section 1.
- [ ] **Image published after validation.** How:
  `gh run list --workflow publish-image --limit 3 --json conclusion,headSha`.
  Pass: a successful publish for the same sha; the workflow_run gate means
  a failed validate never ships an image.
- [ ] **Browser/a11y job green** (`browser` job in `validate` — Playwright
  Station accessibility / honest-state / keyboard / motion suite with axe,
  color-contrast rules enabled). Pass: `success` for the deployed sha.
  You may also re-run locally: `cd frontend && npx playwright test`.

## 6. Accessibility smoke pass

Floor is
[`docs/accessibility/ACCESSIBILITY_CONTRACT.md`](accessibility/ACCESSIBILITY_CONTRACT.md)
(human-readable: 44px targets, luminance-only rank encoding with explicit
text labels, motion reduced by default; OS `prefers-reduced-motion`
overrides the app). Automated gates are proxies — this is the required
human gate on the deployed build.

- [ ] **Keyboard-only pass.** How: unplug-equivalent — no mouse. Skip
  link first, every section action reachable, focus always visible,
  Escape closes drawers/dialogs, focus returns. Pass: every essential
  surface operable; note anything that required a pointer.
- [ ] **Reduced-motion pass.** How: enable OS reduced motion; verify no
  shimmer/pulse/animated skeletons in default presentation and companion
  animation stays restrained. Pass: motion reduced state is respected and
  is the application default.
- [ ] **Phone-width pass.** How: ~360px viewport. Bottom sheets trap
  focus with an explicit close; no control hides under browser UI
  (safe-area insets). Pass: no clipping or unreachable control.
- [ ] **200% zoom pass.** How: real browser zoom at 200% on the Station.
  Pass: layout survives reflow without clipping, truncation, or
  horizontal page scroll.
- [ ] **Rank encoding.** How: do status words appear next to every color/
  luminance-coded status (`healthy`, `needs_attention`, `unavailable`,
  `stale`, `unknown`, `disabled`, `not_configured`)? Pass: no status is
  ever color-only; error messages name what failed and what still works.
  Record (private log): per-device notes, date, anything that failed or
  felt wrong.

---

## Workflow

1. Do the checks in order against the deployment you intend to declare.
2. Tick in your private operator log as you go — this file stays unticked.
3. Outcome = the ALPHA STATUS outcome above; if NOT READY, fix and re-run
   only the failed items.
4. Any change to the deployment (image, config, exposure) invalidates
   sections 1–5; re-run them after the change.
