# DEV-ENVIRONMENT — setting up to work on Project Worlds

Status: canonical dev-setup reference. Audience: a human or an agent about to
run, test, or contribute to Project Worlds. Keep it short and true; this is a
floor, not a manual.

## Principle

One canonical install per tool. The failure mode this doc exists to prevent:
the same tool installed twice (e.g. once in a shared `$HOME` and once inside a
container) so that which one you get depends on `$PATH` order. When a tool is
duplicated, `command -v` lies to you about what will actually run.

## Minimum to run it

| Need | Why |
|---|---|
| `git` | clone the repo |
| `podman` or `docker` | `./install.sh` runs the app in containers |
| Python 3.12 + [`uv`](https://docs.astral.sh/uv/) | the backend, tests, and the `personal-world` CLI |
| Node 20+ (only for the browser gate) | `ui/` Playwright + axe suite |

`./install.sh` is the supported path; re-running it is safe and never deletes
data. See [QUICKSTART.md](QUICKSTART.md) for the user-facing version.

## Verify a checkout

```bash
uv run pytest --timeout=30
uv run personal-world framework validate --json
cd ui && npx playwright test   # boots the real app with a seeded fixture world
```

If all three pass, the checkout is healthy. CI runs the same checks.

## Recommended agent toolchain (optional)

Deterministic CLI tools that make agent work on this repo faster and safer.
None is required to run the app; all are small and offline-first.

| Tool | Use |
|---|---|
| `rg` (ripgrep) | exact text/pattern search |
| `fd` | filesystem discovery |
| `ast-grep` | structural code search (`lab search code`-style, structural not text) |
| `jq` / `yq` | JSON / YAML processing |
| `git` + `delta` | version control, readable diffs |
| `gh` | GitHub CLI (issues, PRs) |
| `just` | repo-local recipes |
| `uv` | Python envs + the app CLI |
| `ctx7` | current upstream library docs (docs lookup without a browser) |
| `fzf` | interactive fuzzy selection (human-only) |

Quick presence check:

```bash
for t in rg fd ast-grep jq yq git gh just uv; do
  command -v "$t" >/dev/null && echo "ok   $t" || echo "MISS $t"
done
```

## Environment hygiene (hard-won)

- **Prefer box-native tooling.** In a container that shares your host `$HOME`,
  host tooling can silently shadow or be shadowed by box tooling. Decide which
  side owns each tool and let a guard/`PATH` rule enforce it, rather than
  relying on whichever rc file sourced last.
- **Make remembered paths work.** When a repo moves, leave a
  symlink at the old path (`ln -s new old`). Anything still holding the old
  absolute path keeps working, and you do not have to remember the move.
- **Secrets never live in tracked config.** Keep keys in an env file that is
  sourced at shell start, and reference them with env substitution
  (`{env:NAME}`) in tool config.
- **One release channel per CLI.** Prefer the upstream installer + its own
  self-update path over hand-building from source, unless you are actively
  contributing upstream.

## Troubleshooting

- **A command runs the wrong version.** `command -v <tool>` and check `$PATH`
  order; watch for a duplicate install in `$HOME` and inside a container.
- **A service says "No such file or directory" after a repo move.** Its unit
  file has a stale absolute path; restore the old path with a symlink or update
  the unit, then `systemctl --user daemon-reload`.
- **MCP tools missing.** `mcp.servers` is the V2 shape (names go *under*
  `servers`, never directly under `mcp`); after a service restart, allow a few
  seconds for servers to reconnect before trusting the list.