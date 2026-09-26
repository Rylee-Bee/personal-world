# Worlds backup & restore — the SOS escape hatch

> **Status:** Reference · **Verified:** 2026-09-26 · **Canonical for:** the encrypted full-instance backup/restore (`pw-worlds-backup/1`) · **Read this if:** you need to save or move a whole Worlds instance

**In short:** One encrypted file plus a passphrase is enough to rebuild the same instance on a fresh machine. This page is the how-to, the archive format, and the exact limits of what is and is not inside.

> One encrypted file. One passphrase. Enough to be the same instance
> again on a fresh machine.

If the box dies, the container rots, or you just want to move house:
`personal-world worlds backup` writes a **single encrypted archive** of
everything durable, and `personal-world worlds restore` imports it into
a fresh build. Nothing else is required but the archive file and the
passphrase you chose.

## The SOS procedure (plain words)

**On the old box (while it still works):**

```bash
personal-world --data-dir ./data --config-dir ./config \
  worlds backup ~/sos/my-world.pwbackup
```

It asks for a passphrase twice (hidden input). Write that passphrase
down somewhere safe — it is the **only** key, it is never stored
anywhere, and nobody (not this app, not any recovery service) can
reopen the archive without it.

**Move two things off the machine:**

1. the archive file (`my-world.pwbackup`), and
2. the passphrase (in your head or your password manager — **not** in
   the same place as the file).

**On the fresh build:**

```bash
docker compose up -d          # or however the fresh build boots
personal-world --data-dir ./data --config-dir ./config \
  worlds restore ~/sos/my-world.pwbackup
```

Then restart the app so registries reload the restored state.

One step an earlier version of this doc skipped: the archive
carries user state, NOT the instance's own credentials or first-run
marker. On a truly fresh box you must still run the normal first-run
setup (`personal-world init` / the setup wizard) to mint `PW_API_TOKEN`
and write `setup-complete` — the restore fills the world back in around
them. A restore into an already-initialized instance needs no extra
step. (Corrected 2026-09-22 from the timed restore drill; the full
covered/not-covered boundary lives in `docs/RECOVERY-BOUNDARY.md`.)

Non-interactive recovery (scripts, systemd) can set
`PW_BACKUP_PASSPHRASE` per-command instead of answering the prompt.

### Compose appliance: the volumes, not host paths

The tracked `compose.yaml` keeps everything in named volumes
(`world-data` at `/data`, `config-data` at `/config` — SSO/provider
config added 2026-09-22, `ollama-data` for models). Named volumes have
no host path to archive from, so on the appliance run the backup from
**inside the core container** (where `data/` and `config/` are real
directories), for example:

```bash
docker compose exec core personal-world \
  --data-dir /data --config-dir /config \
  worlds backup /tmp/my-world.pwbackup
```

then copy the file out (`docker compose cp` or `cat`). The
`config-data` volume matters most after an image update: without it,
`oidc.json` died with the container while `setup-complete` survived —
sign-in broke with no wizard to re-run it.

## Why the passphrase is never a command-line flag

A value in argv is visible to every process on the machine (`ps`),
lands in shell history, and gets captured by process accounting. A
passphrase there would leak the key to your whole world's backup. So
the CLI reads it from a hidden prompt or the environment only, and the
HTTP routes (below) take it in the request body, never a URL.

## What's inside the archive

The full-restore boundary from
[`docs/repo/WIRING-READINESS.md`](repo/WIRING-READINESS.md):

| Included | Notes |
| --- | --- |
| `world.json`, `journal.ndjson` | authoritative truth |
| per-user trees under `users/` | world, journal, reminders, proposals, chat history, prefs |
| `users.json` | identities |
| `reminders.json`, `apps.json`, `proposals.json` | instance state |
| `connections.local.json` | private provider overrides (secret-free by policy) |
| `oidc.json` | **config only** — `client_secret_env` (the env-var *name*) is kept; any inline secret value is stripped and the report says so |
| `discovery.json` | interests/discovery state |
| reconciler + lab desired state | `reconciler/desired/`, `lab.json`, `lab/desired/` |
| theme packs, template sources | `theme-packs/`, `template-sources/` |
| `vault.enc` | **only with `--include-vault`** (see below) |

**Never inside**, even if present on disk:

- `sessions.json` — ephemeral; you re-authenticate on the new box.
- `memory.fts5.db*` — regenerable; the search index rebuilds from the
  journal.
- `updates-session.json` — operational session state.
- tracked repo config (`config/connections.json`) — it ships with the
  build, it is not your data.

## The vault rule (decision #4)

`vault.enc` is already encrypted at rest with its own passphrase. By
default it is **excluded** from backups: an ordinary backup should be
safe to store anywhere without adding a second copy of your secrets to
the world. With `--include-vault` it is archived (still encrypted — it
is never decrypted by this flow) so a full disaster recovery can carry
secret portability with it. The archive itself is encrypted either way.

## The archive format (`pw-worlds-backup/1`)

```text
┌──────────────────────────────────────────────┐
│ header (plaintext JSON, one line)            │
│   format, created_at                         │
│   kdf: scrypt n=32768 r=8 p=1, salt, 32-byte │
│   cipher: AES-256-GCM, nonce                 │
│   manifest_sha256 (of the tar payload)       │
│   included[] / excluded[]  ← names only      │
├──────────────────────────────────────────────┤
│ '\n'                                         │
├──────────────────────────────────────────────┤
│ ciphertext: gzipped tar of the boundary,     │
│ AES-256-GCM, header bytes bound as AAD       │
└──────────────────────────────────────────────┘
```

The plaintext header exposes **structure, never content** — you (or a
tool) can see what the archive covers without the passphrase. Tampering
with the header or a single ciphertext byte fails GCM authentication.
Restore verifies header + auth tag + manifest hash **before writing
anything**: a wrong passphrase or a mutated file changes nothing on
disk.

Fail-closed guarantees:

- Without the `crypto` extra (`pip install 'personal-world[crypto]'`),
  backup and both CLI commands return `unavailable` and write nothing.
  There is no plaintext fallback — an unencrypted "backup" of private
  data is the exact leak this exists to prevent.
- Restore refuses path-traversal members, unknown archive roots, and
  any ephemeral file (`sessions.json`, `memory.fts5.db`) even if a
  hand-crafted archive contains them.
- Every restore returns a per-file report:
  `{restored[], skipped[], refused[]}`.

## Ordinary exports still exclude secrets

This SOS path is **not** the sharing path. The everyday exports
(`settings-export`, `world-export`, `story-export`; see
`src/personal_world/export.py`) remain structurally secret-free:
whitelist walks that cannot carry private-classified data. The rule
stands: what you share is exported; what you *are* is backed up —
encrypted, and only ever restored by someone holding the passphrase.

## HTTP routes (wired, step-up gated)

`worlds_backup.register_worlds_backup(app, ...)` is mounted in `api.py`.
All routes are **step-up gated** (backup/restore hand over or replace the whole
world, so a fresh session must re-prove identity first). No current UI control was
found (as of 2026-09-26): the routes are present in `ui/`'s generated API types,
but no screen calls them — use the CLI, or call the routes directly:

```text
POST /api/worlds/backup                   {passphrase, include_vault}
                                          → {download, included[], excluded[]}
GET  /api/worlds/backup/download/{token}  one-time archive download (then deleted)
POST /api/worlds/restore                  {passphrase, archive_b64, overwrite}
                                          → {restored[], skipped[], refused[]}
```

Registration **refuses** to run without the app's real step-up
dependency — an ungated whole-world export endpoint must never exist by
accident. The passphrase travels in the request body only (never a
query string, never a logged header) and is typed `SecretStr` so it is
redacted from reprs and accidental log lines.

Exact registration call for the wiring pass:

```python
from personal_world.worlds_backup import register_worlds_backup

register_worlds_backup(
    app,
    data_dir=DATA_DIR,
    config_dir=CONFIG_DIR,
    step_up=<the app's real step-up auth dependency>,
)
```

The old Station UI hook (`design/opendesign-exploration/station/backup-ui.js`,
a `#settings-backup` panel) was removed with the retired Station tree on
2026-09-22; the current `ui/` app has no backup panel (checked 2026-09-26: no screen
under `ui/src/screens/` offers backup; use the CLI or API).

## Threat notes (what this does and does not protect against)

- **Protects:** archive-at-rest exposure (strong AEAD), header or
  content tampering (AAD-bound GCM + manifest hash), passphrase sniffing
  via argv/history (prompt/env only), accidental secret duplication
  (vault excluded by default, OIDC secrets stripped), restore of
  hostile archives (traversal/ephemeral refusal, verify-before-write).
- **Does not protect against:** a weak passphrase (scrypt slows
  guessing but cannot rescue `"password"`), or losing the passphrase
  (there is deliberately no recovery mechanism — that is the point).
