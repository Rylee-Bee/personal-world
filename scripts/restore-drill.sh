#!/usr/bin/env bash
# restore-drill — a REAL, timed backup→restore drill for Project Worlds.
#
# Proves (with wall-clock evidence, not assertion) that an encrypted
# worlds backup restores into a CLEAN data dir and boots a working
# instance whose state is verified through authenticated HTTP requests.
#
# Phases (each timed):
#   1. seed      init a throwaway instance in temp dir A (via the app's
#                own CLI: `personal-world init`), boot uvicorn on a free
#                loopback port, seed journal entries, world mutations,
#                identity users and a vault secret through the API,
#                plant ephemeral + non-boundary decoys, then stop.
#   2. backup    `personal-world worlds backup` (CLI, passphrase via
#                PW_BACKUP_PASSPHRASE env — never argv) produces ONE
#                encrypted .pwbackup archive.
#   3. restore   fresh empty temp dir B; `personal-world worlds restore`
#                imports the archive; the restore report + filesystem
#                are checked against the documented boundary.
#   4. verify    boot uvicorn again on B (new instance token) and prove
#                over authenticated requests: journal present, world
#                state present, identities present, vault status
#                reports honestly (locked/absent — vault.enc is not
#                portable by default, decision #4).
#   5. teardown  kill any server this drill started (PID discovered via
#                pgrep, cmdline verified before kill), remove temp dirs.
#
# SAFETY / hygiene:
#   * Binds 127.0.0.1 only; never 0.0.0.0.
#   * Instance tokens and the backup passphrase are generated at
#     runtime, live only in a 0700 temp dir, and are NEVER printed.
#     The token travels to curl via a 0600 config file, never argv.
#   * Refuses to run without the crypto extra (the drill's subject is
#     the encrypted path; without it backup fails closed by design).
#   * All explicit --home-config-dir roots: the drill never touches the
#     real ~/.config/personal-world.
#   * Read-only against the repo: writes go to temp dirs only.
#
# USAGE
#   scripts/restore-drill.sh                 # full drill, prints report
#   scripts/restore-drill.sh --report DIR    # also keep evidence files
#   scripts/restore-drill.sh --keep          # keep temp dirs (debugging)
#   scripts/restore-drill.sh --port 8022     # preferred port (default)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFERRED_PORT=8022
REPORT_DIR=""
KEEP=0

while [[ $# -gt 0 ]]; do
	case "$1" in
	--report) REPORT_DIR="$2"; shift 2 ;;
	--keep) KEEP=1; shift ;;
	--port) PREFERRED_PORT="$2"; shift 2 ;;
	-h | --help) sed -n '2,48p' "$0"; exit 0 ;;
	*) echo "unknown option: $1" >&2; exit 2 ;;
	esac
done

say() { printf '%s\n' "$*"; }
head_phase() {
	printf '\n── %s ' "$1"
	printf '─%.0s' $(seq 1 $((56 - ${#1} > 4 ? 56 - ${#1} : 4)))
	printf '\n'
}
warn() { printf 'WARN: %s\n' "$*" >&2; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

now_ms() { date +%s%3N; }
DRILL_T0=$(now_ms)
PHASE_T=0
PHASE_NAME=""
TIMINGS_FILE=""   # set once WORK exists

phase_begin() { PHASE_NAME="$1"; PHASE_T=$(now_ms); }
phase_end() {
	local end; end=$(now_ms)
	printf '%s\t%s\n' "$PHASE_NAME" "$((end - PHASE_T))" >>"$TIMINGS_FILE"
	printf '    %-22s %7d ms\n' "$PHASE_NAME" "$((end - PHASE_T))"
}

# ── preflight ─────────────────────────────────────────────────────────
preflight() {
	command -v uv >/dev/null || fail "uv not found (needed for uv run)"
	command -v curl >/dev/null || fail "curl not found"
	command -v ss >/dev/null || fail "ss not found (port checks)"
	command -v pgrep >/dev/null || fail "pgrep not found (teardown)"
	command -v openssl >/dev/null || fail "openssl not found (runtime secrets)"
	[[ -d "$REPO_ROOT/.venv" ]] || {
		say "no .venv — running: uv sync --extra test --extra crypto"
		(cd "$REPO_ROOT" && uv sync --extra test --extra crypto >/dev/null)
	}
	(cd "$REPO_ROOT" && uv run --no-sync python -c \
		"import cryptography" >/dev/null 2>&1) ||
		fail "cryptography extra missing — worlds backup fails closed by design; run: uv sync --extra crypto"
	[[ -x "$REPO_ROOT/.venv/bin/uvicorn" ]] ||
		fail "no .venv/bin/uvicorn after sync"
}

port_busy() { ss -ltn 2>/dev/null | grep -Eq "[:.]${1}[[:space:]]"; }

pick_port() {
	local p
	for p in "$PREFERRED_PORT" $(seq $((PREFERRED_PORT + 1)) $((PREFERRED_PORT + 10))); do
		if ! port_busy "$p"; then printf '%s' "$p"; return 0; fi
	done
	fail "no free port in ${PREFERRED_PORT}..$((PREFERRED_PORT + 10))"
}

# ── temp workspace ────────────────────────────────────────────────────
setup_work() {
	WORK=$(mktemp -d "${TMPDIR:-/tmp}/pw-restore-drill.XXXXXXXX")
	chmod 700 "$WORK"
	A_DATA=$WORK/a-data; A_CFG=$WORK/a-config; A_HOME=$WORK/a-home
	B_DATA=$WORK/b-data; B_CFG=$WORK/b-config; B_HOME=$WORK/b-home
	SOS=$WORK/sos
	mkdir -p "$A_DATA" "$A_CFG" "$A_HOME" "$B_DATA" "$B_CFG" "$B_HOME" "$SOS" "$WORK/out" "$WORK/body"
	chmod 700 "$WORK/out" "$WORK/body"
	TIMINGS_FILE=$WORK/timings.tsv
	: >"$TIMINGS_FILE"
	ARCHIVE=$SOS/world.pwbackup
	# Runtime credentials — never printed, never in argv of app calls.
	TOKEN_A_FILE=$WORK/token-a; TOKEN_B_FILE=$WORK/token-b
	PASSPHRASE_FILE=$WORK/passphrase; VAULT_PW_FILE=$WORK/vault-pw
	for f in "$TOKEN_A_FILE" "$TOKEN_B_FILE" "$PASSPHRASE_FILE" "$VAULT_PW_FILE"; do
		umask 077
		openssl rand -hex 24 >"$f"
	done
}

cleanup() {
	local rc=$?
	trap - EXIT
	# Safety net only: phases stop their servers explicitly. Run in a
	# subshell so a stop failure here can never abort the cleanup.
	if [[ "${SERVER_RUNNING:-0}" = 1 ]]; then
		(stop_server "${PORT:-}") || true
	fi
	if [[ $KEEP -eq 1 ]]; then
		say "kept temp workspace: $WORK"
	else
		rm -rf "$WORK"
	fi
	[[ $rc -ne 0 ]] && say "drill exited with status $rc"
	exit $rc
}
trap cleanup EXIT

# ── server helpers ────────────────────────────────────────────────────
# Start bound to loopback only. The token is passed via env (not argv).
start_server() { # $1=data dir  $2=config dir  $3=token file
	SERVER_TOKEN_FILE=$3
	API_PORT=$PORT
	BASE=http://127.0.0.1:$PORT
	SERVER_RUNNING=1
	# setsid + disown: fully detached, and no job-control "Terminated"
	# chatter when teardown kills it. pgrep still matches the argv.
	setsid env \
		PW_DATA_DIR="$1" PW_CONFIG_DIR="$2" \
		PW_API_TOKEN="$(cat "$3")" PW_IDENTITY_MODE=single \
		"$REPO_ROOT/.venv/bin/uvicorn" personal_world.api:create_app --factory \
		--host 127.0.0.1 --port "$PORT" \
		>"$WORK/server-$PORT.log" 2>&1 < /dev/null &
	disown
	wait_health
}

# Stop per the harness protocol: PID from pgrep, cmdline verified,
# kill issued in its own command (never on the start line).
stop_server() {
	local port=$1 pids pid found=0
	pids=$(pgrep -af "uvicorn personal_world.api:create_app" || true)
	if [[ -z "$pids" ]]; then
		warn "no worlds server process found (already gone?)"
		SERVER_RUNNING=0; return 0
	fi
	for pid in $(printf '%s\n' "$pids" | awk -v want="--port $port" 'index($0, want){print $1}'); do
		local cmd
		cmd=$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)
		if [[ "$cmd" == *"personal_world.api:create_app"* && "$cmd" == *"--port $port"* ]]; then
			kill "$pid"
			found=1
		else
			warn "pid $pid cmdline did not match the drill's server; leaving it alone"
		fi
	done
	[[ $found -eq 1 ]] || fail "drill's uvicorn on port $port not found via pgrep"
	local i=0
	while port_busy "$port"; do
		i=$((i + 1)); [[ $i -gt 100 ]] && fail "port $port still busy 10s after kill"
		sleep 0.1
	done
	SERVER_RUNNING=0
}

wait_health() {
	local i=0 code
	while :; do
		code=$(api GET /healthz - /dev/null 2>/dev/null || true)
		[[ "$code" = "200" ]] && return 0
		i=$((i + 1)); [[ $i -gt 200 ]] && { tail -20 "$WORK/server-$API_PORT.log" >&2 || true; fail "server not healthy after ~50s (see log above)"; }
		sleep 0.25
	done
}

# ── HTTP helper ───────────────────────────────────────────────────────
# Token goes into a 0600 curl config file, never argv (process-list
# discipline is the same rule the backup passphrase follows). Bodies
# with secret material are read from 0700 files by curl itself.
api() { # METHOD PATH BODYFILE|"- OUTFILE  → prints http_code
	local method=$1 path=$2 bodyfile=$3 outfile=$4
	local cfg=$WORK/curl.cfg
	umask 077
	{
		printf 'url = "%s%s"\n' "$BASE" "$path"
		printf 'request = "%s"\n' "$method"
		printf 'header = "Authorization: Bearer %s"\n' "$(cat "$SERVER_TOKEN_FILE")"
		printf 'header = "Content-Type: application/json"\n'
		[[ $bodyfile != "-" ]] && printf 'data = "@%s"\n' "$bodyfile"
		printf 'output = "%s"\n' "$outfile"
		printf 'silent\nshow-error\nwrite-out = "%%{http_code}"\n'
	} >"$cfg"
	curl --config "$cfg"
}

# Seed body files (plain JSON, no secrets).
put_json() { # NAME  json-content
	local f="$WORK/body/$1.json"
	printf '%s' "$2" >"$f"
	printf '%s' "$f"
}

# ── phase 1: seed instance A ──────────────────────────────────────────
seed_instance() {
	phase_begin "init-cli"
	(cd "$REPO_ROOT" && uv run --no-sync personal-world \
		--data-dir "$A_DATA" --config-dir "$A_CFG" init --json) \
		>"$WORK/out/init-a.json" || fail "personal-world init failed"
	grep -q '"ok": true' "$WORK/out/init-a.json" || fail "init envelope not ok"
	[[ -f "$A_DATA/setup-complete" && -f "$A_DATA/world.json" ]] ||
		fail "init did not produce setup-complete + world.json"
	phase_end

	phase_begin "server-A-boot"
	start_server "$A_DATA" "$A_CFG" "$TOKEN_A_FILE"
	phase_end

	phase_begin "api-seed"
	local code f
	# Journal entries (person notes; single mode → instance journal).
	local notes=("drill note alpha: kettle verified" "drill note beta: orbit quiet" "drill note gamma: supplies logged")
	for n in "${!notes[@]}"; do
		local body
		body=$(printf '{"text": %s}' "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "${notes[$n]}")")
		f=$(put_json "note-$n" "$body")
		code=$(api POST /api/journal "$f" "$WORK/out/seed-note-$n.json")
		[[ "$code" = "200" ]] || fail "POST /api/journal -> $code"
	done
	# World mutations (facts + intent, step-up via loopback local-owner).
	f=$(put_json fact-1 '{"key":"drill.fact.one","value":"kettle: online"}')
	code=$(api POST /api/world/fact "$f" "$WORK/out/seed-fact-1.json"); [[ "$code" = "200" ]] || fail "world/fact 1 -> $code"
	f=$(put_json fact-2 '{"key":"drill.fact.two","value":"orbit: stable"}')
	code=$(api POST /api/world/fact "$f" "$WORK/out/seed-fact-2.json"); [[ "$code" = "200" ]] || fail "world/fact 2 -> $code"
	f=$(put_json intent-1 '{"key":"drill.intent.one","value":"keep the garden lit"}')
	code=$(api POST /api/world/intent "$f" "$WORK/out/seed-intent-1.json"); [[ "$code" = "200" ]] || fail "world/intent -> $code"
	# Identity records (provisioned via the admin API).
	f=$(put_json user-a '{"user_id":"drill-person-a","display_name":"Drill Person A"}')
	code=$(api POST /api/identity/users "$f" "$WORK/out/seed-user-a.json"); [[ "$code" = "200" ]] || fail "identity user a -> $code"
	f=$(put_json user-b '{"user_id":"drill-person-b","display_name":"Drill Person B"}')
	code=$(api POST /api/identity/users "$f" "$WORK/out/seed-user-b.json"); [[ "$code" = "200" ]] || fail "identity user b -> $code"
	# Vault: initialize vault.enc with a synthetic secret (drives the
	# non-portability check on the restore side).
	local vault_body="$WORK/body/vault-unlock.json"
	umask 077
	printf '{"passphrase": "%s"}' "$(cat "$VAULT_PW_FILE")" >"$vault_body"
	code=$(api POST /api/vault/unlock "$vault_body" "$WORK/out/seed-vault-unlock.json")
	[[ "$code" = "200" ]] || fail "vault/unlock -> $code"
	rm -f "$vault_body"
	f=$(put_json vault-set '{"name":"drill.canary","value":"synthetic-not-a-secret"}')
	code=$(api POST /api/vault/set "$f" "$WORK/out/seed-vault-set.json"); [[ "$code" = "200" ]] || fail "vault/set -> $code"
	[[ -f "$A_DATA/vault.enc" ]] || fail "vault.enc was not created on A"
	phase_end

	phase_begin "decoys+snapshot"
	# Ephemeral files that must NEVER be archived.
	printf '{"session":"ephemeral"}' >"$A_DATA/sessions.json"
	printf 'x' >"$A_DATA/memory.fts5.db"
	printf '{"op":"session"}' >"$A_DATA/updates-session.json"
	# Non-boundary state: a media-like tree the boundary silently omits,
	# and a theme pack the boundary DOES carry (positive control).
	mkdir -p "$A_DATA/media" "$A_DATA/theme-packs/drizzle" "$A_DATA/template-sources/tpl"
	printf 'not-archived' >"$A_DATA/media/photo.bin"
	printf '{"name":"drizzle"}' >"$A_DATA/theme-packs/drizzle/manifest.json"
	printf 'source' >"$A_DATA/template-sources/tpl/source.md"
	# Home config state. Seeded by hand deliberately: the discovery/lab
	# APIs resolve their store to the REAL default ~/.config/personal-world,
	# which a drill must never pollute — so direct write is the only safe
	# path for this part of the boundary (noted in the boundary doc).
	printf '{"interests":["drill"]}' >"$A_HOME/discovery.json"
	mkdir -p "$A_HOME/reconciler/desired" "$A_HOME/lab/desired"
	printf 'service: drill\n' >"$A_HOME/reconciler/desired/drill.yml"
	# Private runtime config on the config-dir side of the boundary:
	# connections.local.json travels as-is; oidc.json travels CONFIG
	# ONLY — an inline secret value planted here (synthetic, never a
	# real credential) must be stripped by the backup and the strip
	# must be reported honestly.
	printf '{"connections":[{"name":"drill","type":"ollama"}]}' >"$A_CFG/connections.local.json"
	printf '{"issuer":"https://sso.example.invalid","client_id":"pw","client_secret_env":"PW_OIDC_CLIENT_SECRET","client_secret":"canary-not-real"}' >"$A_CFG/oidc.json"
	printf '{"connections":[]}' >"$A_CFG/connections.json" # tracked-shape decoy: must NOT be archived
	# Snapshot A through authenticated reads.
	code=$(api GET "/api/journal?n=100" - "$WORK/out/a-journal.json"); [[ "$code" = "200" ]] || fail "A journal GET -> $code"
	code=$(api GET /api/status - "$WORK/out/a-status.json"); [[ "$code" = "200" ]] || fail "A status GET -> $code"
	code=$(api GET /api/identity/users - "$WORK/out/a-users.json"); [[ "$code" = "200" ]] || fail "A users GET -> $code"
	code=$(api GET /api/vault/status - "$WORK/out/a-vault.json"); [[ "$code" = "200" ]] || fail "A vault GET -> $code"
	phase_end

	phase_begin "server-A-stop"
	stop_server "$PORT"
	phase_end
}

# ── phase 2: backup ───────────────────────────────────────────────────
run_backup() {
	phase_begin "backup-cli"
	# Passphrase via per-command env, never argv.
	(cd "$REPO_ROOT" && PW_BACKUP_PASSPHRASE="$(cat "$PASSPHRASE_FILE")" \
		uv run --no-sync personal-world --data-dir "$A_DATA" --config-dir "$A_CFG" \
		worlds --home-config-dir "$A_HOME" backup "$ARCHIVE" --json) \
		>"$WORK/out/backup.json" || fail "worlds backup exited non-zero"
	grep -q '"ok": true' "$WORK/out/backup.json" || fail "backup envelope not ok"
	[[ -f "$ARCHIVE" ]] || fail "archive not written"
	python3 - "$WORK/out/backup.json" "$WORK/out/included.txt" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))["data"]
inc = data["included"]
open(sys.argv[2], "w").write("\n".join(inc) + "\n")
need = {"data/world.json", "data/journal.ndjson", "data/users.json",
        "data/theme-packs/drizzle/manifest.json", "data/template-sources/tpl/source.md",
        "home/discovery.json", "home/reconciler/desired/drill.yml",
        "config/connections.local.json", "config/oidc.json"}
missing = need - set(inc)
assert not missing, f"boundary files MISSING from archive: {sorted(missing)}"
forbidden = [n for n in inc if n.endswith(("vault.enc", "sessions.json",
            "memory.fts5.db", "updates-session.json", "config/connections.json"))
            or "/media/" in n]
assert not forbidden, f"archive carries files it must never carry: {forbidden}"
# The OIDC config-only rule must be REPORTED, not silent.
strips = [w for w in data["excluded"] if "stripped" in w]
assert any("config/oidc.json" in w for w in strips), \
    "inline oidc secret was planted but no strip was reported"
print("    backup note: oidc inline secret stripped and reported")
PY
	phase_end
}

# ── phase 3: restore into clean dir B ────────────────────────────────
run_restore() {
	phase_begin "restore-cli"
	(cd "$REPO_ROOT" && PW_BACKUP_PASSPHRASE="$(cat "$PASSPHRASE_FILE")" \
		uv run --no-sync personal-world --data-dir "$B_DATA" --config-dir "$B_CFG" \
		worlds --home-config-dir "$B_HOME" restore "$ARCHIVE" --json) \
		>"$WORK/out/restore.json" || fail "worlds restore exited non-zero"
	grep -q '"ok": true' "$WORK/out/restore.json" || fail "restore envelope not ok"
	python3 - "$WORK/out/restore.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))["data"]
assert d["restored"], "nothing restored"
assert not d["refused"], f"unexpected refusals: {d['refused']}"
assert not d["skipped"], f"fresh target should skip nothing: {d['skipped']}"
PY
	# Byte-identity of the authoritative files.
	cmp "$A_DATA/world.json" "$B_DATA/world.json" || fail "world.json differs"
	cmp "$A_DATA/journal.ndjson" "$B_DATA/journal.ndjson" || fail "journal.ndjson differs"
	cmp "$A_DATA/users.json" "$B_DATA/users.json" || fail "users.json differs"
	cmp "$A_HOME/discovery.json" "$B_HOME/discovery.json" || fail "home discovery differs"
	cmp "$A_CFG/connections.local.json" "$B_CFG/connections.local.json" ||
		fail "connections.local.json differs"
	# oidc.json must land SANITIZED: env-var name kept, inline value gone.
	grep -q "PW_OIDC_CLIENT_SECRET" "$B_CFG/oidc.json" || fail "oidc env-indirection lost"
	grep -q "stripped-by-worlds-backup" "$B_CFG/oidc.json" || fail "oidc secret not stripped"
	grep -q "canary-not-real" "$B_CFG/oidc.json" && fail "planted secret survived the round trip"
	# What must NOT be on the far side.
	for banned in "$B_DATA/vault.enc" "$B_DATA/sessions.json" "$B_DATA/memory.fts5.db" \
		"$B_DATA/updates-session.json" "$B_DATA/media/photo.bin"; do
		[[ -e "$banned" ]] && fail "restored a file that must never travel: $banned"
	done
	[[ -f "$B_DATA/theme-packs/drizzle/manifest.json" ]] || fail "theme pack not restored"
	# OBSERVED BOUNDARY FACT: the setup-complete marker is NOT part of
	# the archive — a restored instance is not boot-complete until the
	# operator runs first-run init/setup again (credentials are
	# intentionally non-portable). Record it honestly, then close the
	# gap the way an operator would.
	BOOT_GAP=missing
	[[ -f "$B_DATA/setup-complete" ]] && BOOT_GAP=present
	(cd "$REPO_ROOT" && uv run --no-sync personal-world \
		--data-dir "$B_DATA" --config-dir "$B_CFG" init --json) \
		>"$WORK/out/init-b.json" || fail "first-run init on B failed"
	grep -q '"ok": true' "$WORK/out/init-b.json" || fail "init B envelope not ok"
	# init is create-if-absent: the restored world must be untouched.
	cmp "$A_DATA/world.json" "$B_DATA/world.json" || fail "init clobbered restored world.json"
	phase_end
}

# ── phase 4: verify a working instance on B ───────────────────────────
verify_instance() {
	phase_begin "server-B-boot"
	start_server "$B_DATA" "$B_CFG" "$TOKEN_B_FILE"
	phase_end

	phase_begin "api-verify"
	local code
	code=$(api GET /api/setup/status - "$WORK/out/b-setup.json")
	[[ "$code" = "200" ]] || fail "B setup status -> $code"
	python3 - "$WORK/out/b-setup.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
assert d["data"]["complete"] is True, "restored instance reports setup incomplete"
PY
	code=$(api GET "/api/journal?n=100" - "$WORK/out/b-journal.json")
	[[ "$code" = "200" ]] || fail "B journal GET -> $code"
	for text in "drill note alpha: kettle verified" "drill note beta: orbit quiet" \
		"drill note gamma: supplies logged" "user provisioned: drill-person-a" \
		"user provisioned: drill-person-b"; do
		grep -qF "$text" "$WORK/out/b-journal.json" ||
			fail "journal entry missing after restore: $text"
	done
	code=$(api GET /api/status - "$WORK/out/b-status.json")
	[[ "$code" = "200" ]] || fail "B status GET -> $code"
	python3 - "$WORK/out/b-status.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))["data"]
assert d["facts"] >= 2 and d["intents"] >= 1, f"world state missing: {d}"
PY
	code=$(api GET /api/identity/users - "$WORK/out/b-users.json")
	[[ "$code" = "200" ]] || fail "B users GET -> $code"
	grep -qF "drill-person-a" "$WORK/out/b-users.json" || fail "identity a missing after restore"
	grep -qF "drill-person-b" "$WORK/out/b-users.json" || fail "identity b missing after restore"
	code=$(api GET /api/vault/status - "$WORK/out/b-vault.json")
	[[ "$code" = "200" ]] || fail "B vault GET -> $code"
	python3 - "$WORK/out/b-vault.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))["data"]
# Honest report per the non-portable-vault decision: locked, and NOT
# encrypted-capable because vault.enc was never carried over.
assert d["locked"] is True, f"vault unexpectedly unlocked on restored box: {d}"
assert d.get("encrypted", True) is False, f"vault claims encryption without vault.enc: {d}"
PY
	phase_end

	phase_begin "server-B-stop"
	stop_server "$PORT"
	phase_end
}

# ── main ──────────────────────────────────────────────────────────────
preflight
PORT=$(pick_port)
SERVER_RUNNING=0
setup_work
trap cleanup EXIT

say "Project Worlds restore drill"
say "repo:  $REPO_ROOT"
say "server: 127.0.0.1:$PORT (token never printed)"
say "workspace: $WORK"
[[ "$PORT" != "$PREFERRED_PORT" ]] && say "note: $PREFERRED_PORT busy; using $PORT"

seed_instance
run_backup
run_restore
verify_instance

TOTAL=$(( $(now_ms) - DRILL_T0 ))
ARCHIVE_BYTES=$(stat -c %s "$ARCHIVE")
N_INCLUDED=$(wc -l <"$WORK/out/included.txt")

if [[ -n "$REPORT_DIR" ]]; then
	mkdir -p "$REPORT_DIR"
	cp "$WORK/timings.tsv" "$WORK/out/backup.json" "$WORK/out/restore.json" \
		"$WORK/out/included.txt" "$REPORT_DIR/" 2>/dev/null || true
	say "evidence copied to: $REPORT_DIR"
fi

head_phase "DRILL REPORT (measured)"
printf '    %-22s %7s\n' phase duration_ms
while IFS=$'\t' read -r name ms; do printf '    %-22s %9s\n' "$name" "$ms"; done <"$WORK/timings.tsv"
printf '    %-22s %9s\n' "─── total" "$TOTAL"
say ""
say "archive:            world.pwbackup (${ARCHIVE_BYTES} bytes, AES-256-GCM)"
say "members included:   ${N_INCLUDED}"
say "vault on B:         absent by design (decision #4) — status honestly locked/unencrypted"
say "setup marker on B:  ${BOOT_GAP:-unknown} in archive (non-portable by design; re-init/first-run closes it)"
say ""
say "RESULT: PASS — a bundle exported from A recreated a working instance on clean B; $TOTAL ms wall-clock."
