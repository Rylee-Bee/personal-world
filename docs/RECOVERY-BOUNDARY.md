# 🛟 Recovery boundary — measured, not aspirational

> **Status:** Reference · **Verified:** 2026-09-26 · **Canonical for:** what one encrypted `.pwbackup` restore actually recovers · **Read this if:** you are restoring Worlds, or writing recovery/backup docs.

**In short:** what one encrypted worlds bundle (`personal-world worlds
backup` → `.pwbackup`) **actually** restores, proven by a live timed drill
on 2026-09-21 rather than by doc inference. Companion to
[`WORLDS-BACKUP.md`](WORLDS-BACKUP.md); where the two disagree, **this
file carries the observed truth** and the disagreement is flagged. Timings
are from that one drill; re-run `scripts/restore-drill.sh` for fresh
numbers.

Evidence sources, all reproducible on any machine with the repo env:

| Artifact | What it is |
| --- | --- |
| [`../scripts/restore-drill.sh`](../scripts/restore-drill.sh) | The real drill: temp instance A → API-seed → backup → clean dir B → restore → uvicorn on B → authenticated verification → teardown, every phase timed |
| [`../tests/test_restore_drill.py`](../tests/test_restore_drill.py) | The same round-trip in CI form (`tmp_path` + `TestClient`), pinning the boundary — including the gaps — so a future change to it fails a test |
| [`../tests/test_worlds_backup.py`](../tests/test_worlds_backup.py) | Unit-level boundary + crypto guarantees (tamper, traversal refusal, `--include-vault`) |

## Verdict of the drill

✅ **PASS.** An encrypted bundle exported from a seeded instance
restored a **working** instance on a clean data dir: journal entries,
world facts/intents, identity users, theme packs, template sources,
private config and home state all present and byte-identical on the
far side, verified over authenticated HTTP. Total wall-clock of the
full five-phase drill: **≈ 2.2 s** (table below).

## Measured timings (drill run of 2026-09-21, this repo's `uv` env)

| Phase | ms | What ran |
| --- | ---: | --- |
| init-cli | 177 | `personal-world init` on A (app's own CLI) |
| server-A-boot | 273 | uvicorn (loopback) starts + `/healthz` 200 |
| api-seed | 197 | 2 journal notes, 2 world facts, 1 intent, 2 identity users, vault init + secret — all via the HTTP API |
| decoys+snapshot | 29 | plant ephemeral/non-boundary decoys, read A back |
| server-A-stop | 211 | graceful stop, port released |
| **backup-cli** | **277** | `worlds backup` → one 2,432-byte AES-256-GCM archive (9 members) |
| **restore-cli** | **398** | `worlds restore` into clean B (verify-before-write, 9 restored / 0 skipped / 0 refused) |
| server-B-boot | 266 | uvicorn on B with a **new** instance token |
| api-verify | 75 | journal + status + identity + vault honesty over authenticated GETs |
| server-B-stop | 204 | teardown |
| **total** | **2,161** | seed + export + restore + verify, end to end |

The recovery-critical pair — backup + restore — is **675 ms**. scrypt
(n=32768) key derivation runs once per side and dominates neither.
Timings vary by machine; the CI test bounds them only pathologically
(< 60 s per side).

## What IS covered 📦 (observed in the drill's backup report)

Restored byte-identical (data/config/home members):

| Member (as archived) | Verified by |
| --- | --- |
| `data/world.json` — facts, intents, policies, lore | drill `cmp` A↔B + `GET /api/status` on B |
| `data/journal.ndjson` — the full journal | drill `cmp` + `GET /api/journal` on B shows seeded notes and provisioning events |
| `data/users.json` — identity records (hashed tokens) | drill `GET /api/identity/users` on B lists both provisioned persons |
| `data/users/**` — per-user trees (world, journal, reminders, proposals, chat, prefs) | unit round-trip byte-compares `users/<person>/world.json`; drill ran single-mode, where instance state *is* the person state |
| `data/reminders.json`, `data/apps.json`, `data/proposals.json`, `data/chat-history.ndjson` | boundary-listed; unit round-trip |
| `data/theme-packs/**`, `data/template-sources/**` | drill restored `theme-packs/drizzle/manifest.json` + `template-sources/tpl/source.md` |
| `config/connections.local.json` | drill `cmp` A↔B byte-identical |
| `config/oidc.json` — **config only** | drill planted an inline secret; backup reported `stripped-by-worlds-backup` and B's copy keeps `client_secret_env` (the name), not the value |
| `home/discovery.json`, `home/lab.json`, `home/reconciler/desired/**`, `home/lab/desired/**` | drill restored + byte-compared `discovery.json` and `reconciler/desired/drill.yml` |
| `data/vault.enc` + per-user vaults | **only with `--include-vault`** — default excluded (decision #4); flag behaviour pinned by `test_vault_excluded_by_default_included_with_flag` |

## What is NOT covered ❌ (and what the drill proved)

| Not in the bundle | Evidence / status |
| --- | --- |
| `vault.enc` (instance + per-user) | Drill: excluded note verbatim; B has no `vault.enc`; `GET /api/vault/status` on B reports `locked: true, encrypted: false`. Opt in with `--include-vault`. |
| Instance credential: `PW_API_TOKEN` / `data/.env` | Never archived. The restored box runs on a **freshly supplied** token (drill B used a new one; CI test pins the absence). Credentials not being portable is the point. |
| `setup-complete` marker | ⚠️ **Found gap — see below.** Not archived; a restored data dir is not boot-complete until a first-run pass (`personal-world init`, or the setup wizard) re-creates it. |
| `sessions.json`, `memory.fts5.db*`, `updates-session.json` | Never archived and refused even if a hostile archive carries them (drill + unit test). Expected: you re-authenticate; the search index rebuilds from the journal. |
| **Anything under `data/` outside the listed files and the `users/`, `theme-packs/`, `template-sources/` trees** | Drill planted `data/media/photo.bin`: it appears in **neither** `included` **nor** `excluded` — silently absent from the archive. |
| Media libraries (Plex/Sonarr/Radarr content) | Never local data: `/api/media/*` proxies external services. Their state lives on those services, not in the bundle. |
| Tracked repo config (`config/connections.json`), the install itself | Ships with the build; drill decoy proved it is not archived. |
| Provider-side / external state (OIDC issuer, LLM providers) | Outside the product's disk entirely. |

## ⚠️ Found defects (flagged loudly, from observed behaviour)

1. **`WORLDS-BACKUP.md` overstates boot completeness.** It says
   "Nothing else is required but the archive file and the passphrase"
   and ends the procedure at "restart the app". The drill shows a
   restored instance is missing the `setup-complete` marker (and any
   `.env` token), so **a first-run step is required after restore** —
   `personal-world init` (idempotent; it does NOT touch restored
   state, verified byte-identical after) or the setup wizard. Data
   recovery is complete; *boot* recovery needs one extra documented
   command. This is a documentation defect (the behaviour is the
   credential-hygiene design), now fixed by the sequence below;
   `WORLDS-BACKUP.md` should adopt step 3.
2. **Silent exclusion of unknown data subtrees.** The drill's
   `data/media/photo.bin` was neither archived nor listed as excluded.
   Anything a future feature writes elsewhere under `data/` would
   vanish from SOS backups without a word in the report. **RESOLVED
   (bc65f40):** `worlds_backup` now appends an explicit "NOT recognized
   by the backup boundary — not archived" note for any top-level `data/`
   entry outside the allow-list, so a future local store surfaces in
   every report instead of vanishing silently. Regression test pinned.
   Tracked for the orchestrator:
   consider a report line for unrecognised top-level entries under
   the data dir. (src behaviour left untouched by this drill, per
   lane rules.)
3. The home-state exclusion note is **inaccurate when those files are
   simply absent**: `excluded[]` always lists sessions/fts/vault
   notes even if the file never existed. Harmless but noisy; honesty
   intact.

None of these broke the drill's verification; all are boundary truth,
recorded here so nobody re-derives them.

## Recovery procedure (verified by the drill, in this order)

```bash
# 0. On the old box, periodically:
personal-world --data-dir ./data --config-dir ./config \
  worlds backup ~/sos/my-world.pwbackup
# passphrase via hidden prompt, or PW_BACKUP_PASSPHRASE env per-command

# 1. On the fresh build, restore into the (empty) instance dirs:
personal-world --data-dir ./data --config-dir ./config \
  worlds --home-config-dir ~/.config/personal-world \
  restore ~/sos/my-world.pwbackup

# 2. Optional, only if this instance should carry its vault: re-run
#    step 0 with --include-vault BEFORE the old box dies.

# 3. FIRST-RUN PASS (the found-gap step): satisfy the boot marker and
#    mint a fresh credential. Either the CLI:
personal-world --data-dir ./data --config-dir ./config init
# ...or open the app and complete the /setup wizard (it mints this
# box's own token; the vault passphrase is set in the app afterwards,
# not in the wizard). init is create-if-absent:
# it never overwrites the restored world.

# 4. Boot and work:
#    uvicorn personal_world.api:create_app --factory (compose does this)
```

To re-run this very drill with fresh timings:

```bash
scripts/restore-drill.sh --report /tmp/drill   # full live drill
uv run pytest tests/test_restore_drill.py -v   # same round-trip, CI form
```

## Threat-model reminders (unchanged)

Archive is AES-256-GCM (scrypt N=32768); header is AAD-bound; restore
verifies header + tag + manifest hash **before writing anything**; a
wrong passphrase changes nothing on disk (pinned by
`test_restore_drill_wrong_passphrase_writes_nothing`). No passphrase
recovery exists — losing it loses the bundle. That asymmetry is the
design, not a defect.
