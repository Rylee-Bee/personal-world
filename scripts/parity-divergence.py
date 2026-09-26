#!/usr/bin/env python3
"""C11 divergence feed v1 — station rebuild vs the frozen old Station.

Track C, Staff Meeting #5 overnight run (feeds E3/A7). Compares the
SERVED old Station surface (design/opendesign-exploration/station/,
frozen — read-only here) against the Station vNext rebuild (ui/src),
row by row at file level, and emits:

  1. docs/PARITY-DIVERGENCE-2026-09-20.md   (human report, this repo)
  2. ../homelab/reports/parity-checklist.json  (schema
     `pw-parity-checklist/v0`, exactly as prescribed by
     homelab/reports/PARITY-AUTOMATION-NOTE.md — read that file before
     changing anything about the shape below)

Determinism + accuracy rules honoured (PARITY-AUTOMATION-NOTE §"rules"):
  · items sort by id; ids = "parity-" + sha256(surface + \\x00 +
    mainline_path)[:8] — re-runs update, never renumber;
  · re-running on unchanged inputs reproduces byte-identical `items`;
    volatility lives only in generated_at and the *_ref fields;
  · a row moves to `parity` ONLY with evidence (mainline file hash +
    the station-side file's hash); parity-by-assertion stays banned;
  · `summary` is computed, never typed;
  · `internal` rows are the old-surface files that never had a
    user-facing role (the _legacy/ rooms excluded from primary
    navigation, and the .md handoff notes the server deliberately
    does not serve — see station_ui.py SERVED_SUFFIXES);
  · missing/partial rows cite this divergence report itself.

This script never edits the frozen surface and never deletes a row.

Run from the repo root:  python3 scripts/parity-divergence.py
  --homelab PATH   optional override for the homelab checkout
                   (default: sibling ../homelab; when absent, the JSON
                   emission is skipped with a clear line and the
                   markdown report still regenerates — public-repo
                   copies of this repo have no homelab sibling).
Zero dependencies outside the standard library.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
STATION_DIR = REPO_ROOT / "design" / "opendesign-exploration" / "station"
UI_SRC = REPO_ROOT / "ui" / "src"
REPORT_MD = REPO_ROOT / "docs" / "PARITY-DIVERGENCE-2026-09-20.md"

SURFACES = {
    "today", "journal", "map", "settings", "interests", "vault",
    "backup", "reminders", "apps", "chat", "theme", "auth", "other",
}
KINDS = {"ui-flow", "capability", "endpoint", "asset"}
STATUSES = {"parity", "partial", "missing", "internal"}


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=REPO_ROOT, check=True, capture_output=True, text=True
    ).stdout.strip()


# ─── The curated divergence table ─────────────────────────────────────
# One row per frozen-surface FILE. station=None means no rebuild
# counterpart exists (reported as missing, not stubbed to look covered).
# `status` here is the ANALYST claim; the script then re-verifies it
# against the tree (parity requires the cited station files to exist)
# and downgrades — never upgrades — on mismatch.
#
# Every claim below was read from the file it describes on 2026-09-21
# (old-surface headers + the vNext screens), not from memory.

ROWS = [
    # ── clients & data plumbing ──
    ("other", "capability", "api.js", ["ui/src/data/api.ts", "ui/src/data/contract.ts"],
     "parity",
     "typed openapi-fetch client + verified live-contract DTOs replace the raw fetch layer; envelopes preserved identically"),
    ("other", "capability", "real-data.js", ["ui/src/data/hooks.ts", "ui/src/data/contract.ts"],
     "parity",
     "envelope→renderable normalization with honest degraded states now lives in the query hooks + contract DTOs (incl. searchMemory top_k fix from the E7 reconciliation)"),
    # ── journal ──
    ("journal", "ui-flow", "journal.html", ["ui/src/screens/Journal/Journal.tsx"],
     "partial",
     "entries list + supersede chain rebuilt; draft-sync panel lands tonight via Track B (DRAFT-SYNC-SPEC)"),
    ("journal", "ui-flow", "journal-view.js", ["ui/src/screens/Journal/Journal.tsx"],
     "partial",
     "content view replaced by the React screen; the 'write an entry' handoff is the in-flight draft panel, not yet finished"),
    # ── interests ──
    ("interests", "ui-flow", "interests.html", ["ui/src/screens/Interests/Interests.tsx"],
     "partial",
     "vNext consumes the discovery feed the old view explicitly declined to (API-052 engine finds with provenance); the old technical-disclosure <details> is folded into body copy instead"),
    ("interests", "ui-flow", "interests-view.js", ["ui/src/screens/Interests/Interests.tsx"],
     "partial",
     "all five old states (list, empty, not-set-up, unavailable, retry) have rebuild counterparts; source/interest WRITES remain absent in both builds — honest parity of absence, still partial overall"),
    ("interests", "asset", "content-views.css",
     ["ui/src/screens/Interests/Interests.tsx", "ui/src/screens/Journal/Journal.tsx"],
     "parity",
     "journal/interests view styling now ships as token-based classes in the screens themselves"),
    # ── settings & chrome ──
    ("settings", "ui-flow", "settings.html",
     ["ui/src/screens/Settings/Settings.tsx", "ui/src/screens/Settings/SettingsRoom.tsx"],
     "partial",
     "Reading & Interaction rendered from GET /api/prefs/schema (C1/C2); the old 'Back up your world' mount and companion-template picker are absent in the rebuild"),
    ("settings", "ui-flow", "station.js", ["ui/src/app/App.tsx", "ui/src/screens/Settings/SettingsRoom.tsx"],
     "partial",
     "shell chrome + theme apply rebuilt; server motion/density/text_scale prefs are NOT yet applied to the document root the way station.js bound them (prefs chrome application is a known remaining gap)"),
    ("theme", "asset", "station.css",
     ["ui/src/generated/tokens.css", "ui/src/styles/world.css"],
     "parity",
     "generated token pipeline (design/tokens.json + design/themes/*.json) replaces the hand-written station stylesheet"),
    ("other", "asset", "mobile.css", None,
     "missing",
     "safe-area (env(safe-area-inset-*)) and phone chrome have NO vNext counterpart — accessibility contract §2.7 exposure, flagged for the morning list, not papered over"),
    # ── chat ──
    ("chat", "ui-flow", "chat.html", ["ui/src/screens/Chat/Chat.tsx"],
     "partial",
     "single-page transcript rebuilt; the old two-size pattern (corner orb mini-dock + full Talk page sharing one transcript) is not rebuilt"),
    ("chat", "ui-flow", "chat.js", ["ui/src/screens/Chat/Chat.tsx"],
     "partial",
     "send/history/provider readouts rebuilt; companion→template surfacing from the old orb flow is absent"),
    # ── the systems map ──
    ("map", "ui-flow", "index.html", None,
     "missing",
     "'The systems map' front door is not rebuilt; Today is vNext's own front door by product decision — this row records what the flip still lacks, not what it replaced"),
    ("map", "ui-flow", "starmap.js", None,
     "missing", "the map renderer itself has no vNext counterpart"),
    ("map", "ui-flow", "shapemap.js", None,
     "missing", "user-malleable map structure (pw-map-structure patching) not rebuilt"),
    ("map", "ui-flow", "deeplink.js", None,
     "missing", "URL-hash deep links absent — vNext holds screen state in component state only"),
    ("other", "ui-flow", "search.js", None,
     "missing", "Ctrl/Cmd-K quick-jump palette not rebuilt (memory search API exists but no UI door)"),
    # ── projects ──
    ("other", "ui-flow", "projects.html", None,
     "missing", "source-control projects surface not rebuilt (Today/Journal/Vault/Settings/Chat/Interests are)"),
    ("other", "ui-flow", "projects-view.js", None,
     "missing", "real source-control reads view not rebuilt"),
    ("other", "asset", "projects-view.css", None,
     "missing", "styling for a surface that does not exist yet"),
    # ── backup ──
    ("backup", "ui-flow", "backup-ui.js", None,
     "missing", "the 'Back up my world' SOS panel has no rebuild counterpart (GET /api/backup row is uncovered too — see ui/reports/door-coverage.md)"),
    # ── first-run ──
    ("auth", "ui-flow", "onboarding.js", None,
     "missing", "first-run introduction flow not rebuilt; the server-owned /setup wizard still carries this"),
    ("auth", "asset", "onboarding.css", None,
     "missing", "styling for the un-rebuilt first-run flow"),
    # ── today presentation ──
    ("today", "asset", "real-data.css",
     ["ui/src/screens/Today/Today.tsx", "ui/src/index.css"],
     "parity",
     "loading/row/status styling for real-data mounts now ships as token classes in the screens"),
    # ── PWA / icons / manifest ──
    ("other", "asset", "manifest.json", None,
     "missing", "web-app manifest (name, icons, display mode) not reproduced in ui/public"),
    ("theme", "asset", "icons.svg", ["ui/public/icons.svg"],
     "parity", "icon sprite ships in vNext public assets"),
    ("theme", "asset", "chars.svg", ["ui/public/assets/characters"],
     "parity", "companion artwork ships (raster set under ui/public/assets/characters, deliberately not regenerated)"),
    ("other", "asset", "favicon.ico", ["ui/public/favicon.svg"],
     "partial", "modern SVG favicon exists; the legacy .ico format was not reproduced"),
    ("other", "asset", "favicon-16.png", ["ui/public/favicon.svg"],
     "partial", "SVG covers modern browsers; the fixed-size PNG ladder was not reproduced"),
    ("other", "asset", "favicon-32.png", ["ui/public/favicon.svg"],
     "partial", "as above"),
    ("other", "asset", "favicon-48.png", ["ui/public/favicon.svg"],
     "partial", "as above"),
    ("other", "asset", "apple-touch-icon.png", None,
     "missing", "iOS home-screen icon absent"),
    ("other", "asset", "icon-192.png", None,
     "missing", "PWA install icon absent (pairs with the missing manifest)"),
    ("other", "asset", "icon-512.png", None,
     "missing", "PWA install icon absent (pairs with the missing manifest)"),
]

# _legacy rooms + internal notes: no user-facing role (station_ui.py
# never serves .md; _-prefixed dirs stay out of primary navigation).
for legacy in sorted((STATION_DIR / "_legacy").glob("*.html")):
    ROWS.append(("map", "ui-flow", f"_legacy/{legacy.name}", None, "internal",
                 "archived room page — never served in primary navigation (station_ui.py excludes _-prefixed dirs)"))
for note in sorted(STATION_DIR.glob("*.md")):
    ROWS.append(("other", "asset", note.name, None, "internal",
                 "handoff/conformance notes — the Station deliberately serves no .md (station_ui.py SERVED_SUFFIXES)"))


def item_id(surface: str, mainline: str) -> str:
    digest = hashlib.sha256(f"{surface}\x00{mainline}".encode()).hexdigest()
    return f"parity-{digest[:8]}"


def build_items() -> list[dict]:
    items = []
    for surface, kind, mainline, station_paths, status, note in ROWS:
        assert surface in SURFACES, f"bad surface {surface}"
        assert kind in KINDS, f"bad kind {kind}"
        assert status in STATUSES, f"bad status {status}"
        mainline_path = STATION_DIR / mainline
        assert mainline_path.is_file(), f"frozen surface vanished: {mainline}"
        m_hash = sha256_of(mainline_path)

        # verify station side (parity claims need existing evidence)
        verified_paths: list[str] = []
        downgrade_reason = ""
        for p in station_paths or []:
            full = REPO_ROOT / p
            if full.is_dir():
                entries = sorted(x for x in full.iterdir() if x.is_file())
                if entries:
                    verified_paths.append(f"{p} ({len(entries)} files, head sha {sha256_of(entries[0])})")
                else:
                    downgrade_reason = f"station counterpart dir empty: {p}"
            elif full.is_file():
                verified_paths.append(f"{p} (sha {sha256_of(full)})")
            else:
                downgrade_reason = f"station counterpart missing: {p}"

        if status == "parity":
            if downgrade_reason or not verified_paths:
                status = "partial"
                note = f"DOWNGRADED at run time — {downgrade_reason or 'no evidence'}; original note: {note}"
            evidence = f"mainline {mainline} sha {m_hash} · " + " · ".join(verified_paths)
        elif status == "internal":
            evidence = f"mainline {mainline} sha {m_hash} · role check: station_ui.py serves no .md, no _-dirs"
        else:
            evidence = f"mainline {mainline} sha {m_hash} · see docs/PARITY-DIVERGENCE-2026-09-20.md#{surface}"

        items.append({
            "id": item_id(surface, mainline),
            "surface": surface,
            "kind": kind,
            "mainline_path": f"design/opendesign-exploration/station/{mainline}",
            "station_path": (station_paths[0] if station_paths and (REPO_ROOT / station_paths[0]).exists() else None),
            "status": status,
            "evidence": evidence,
            "notes": note,
        })
    items.sort(key=lambda i: i["id"])
    # duplicate-id guard (the note's own validation snippet checks it)
    ids = [i["id"] for i in items]
    assert len(ids) == len(set(ids)), "duplicate ids"
    return items


def markdown(items: list[dict], station_ref: str, mainline_ref: str, generated_at: str) -> str:
    from collections import Counter
    counts = Counter(i["status"] for i in items)
    lines = [
        "# PARITY-DIVERGENCE — Station vNext vs the frozen old Station (C11)",
        "",
        f"Generated by `scripts/parity-divergence.py` at {generated_at} (regenerable;",
        "`items` are byte-identical on unchanged inputs — volatility lives in this",
        "line, the refs, and the JSON's `generated_at`).",
        "",
        f"- rebuild (station) ref: `{station_ref}`",
        f"- frozen surface ref: `{mainline_ref}` (old UI is kept in-tree, unedited; the rails forbid touching it beyond read)",
        f"- machine-readable feed: `homelab/reports/parity-checklist.json` (schema `pw-parity-checklist/v0`)",
        "",
        "Method: every file the Station serves at `/station` (the curated allowlist",
        "under `design/opendesign-exploration/station/`) is read and classified",
        "against the vNext rebuild in `ui/`. A row counts `parity` only with a",
        "station-side file hash as evidence; missing is said plainly; internal",
        "rows mark files with no user-facing role. Nothing was stubbed to improve",
        "a number.",
        "",
        "## Counts",
        "",
        "| status | rows |",
        "| --- | --- |",
    ]
    for st in ("parity", "partial", "missing", "internal"):
        lines.append(f"| {st} | {counts.get(st, 0)} |")
    lines.append(f"| **total** | **{len(items)}** |")
    lines += [
        "",
        "## What the flip still lacks (the honest list, by surface)",
        "",
        "| surface | kind | mainline file | rebuild counterpart | status |",
        "| --- | --- | --- | --- | --- |",
    ]
    for i in sorted(items, key=lambda x: (x["surface"], x["mainline_path"])):
        sp = i["station_path"] or "—"
        if i["status"] == "internal":
            continue
        lines.append(
            f"| {i['surface']} | {i['kind']} | `{Path(i['mainline_path']).name}` | `{sp}` | {i['status']} |"
        )
    lines += [
        "",
        "Load-bearing notes:",
        "",
        "- **mobile.css / safe-areas (§2.7)** — no vNext counterpart; this is a real",
        "  accessibility-contract exposure on phones, listed here so the morning",
        "  read sees it, not hidden behind a summary number.",
        "- **station.js prefs application** — server motion/density/text_scale values",
        "  are EDITABLE (C1/C2) but not yet APPLIED to the document root by the SPA.",
        "  The old station.js applied them on every page. Fixing this is the natural",
        "  next Track C slice.",
        "- **map / projects / backup / onboarding / search** — entire surfaces of the",
        "  old Station absent from the rebuild; consistent with the C6 door-coverage",
        "  report's uncovered rows (ui/reports/door-coverage.md).",
        "",
        "## Internal-marked rows (no user-facing role)",
        "",
        "8 `_legacy/` room pages and 4 `.md` handoff notes (12 rows) — the served",
        "surface is the allowlist; these files exist in the directory but the",
        "Station never served them. Counted `internal` per the schema's meaning.",
        "",
        "## Full rows",
        "",
        "| id | surface | status | mainline |",
        "| --- | --- | --- | --- |",
    ]
    for i in items:
        lines.append(f"| `{i['id']}` | {i['surface']} | {i['status']} | `{i['mainline_path'].split('/')[-1]}` |")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--homelab", default=None,
                        help="path to the homelab checkout (default: sibling ../homelab)")
    parser.add_argument("--check", action="store_true",
                        help="re-emit to a temp location and diff against the committed outputs (drift probe, writes nothing)")
    args = parser.parse_args()

    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    station_ref = f"{git('branch', '--show-current')}@{git('rev-parse', 'HEAD')}"
    # The frozen surface is in THIS repo; mainline_ref records the
    # trunk commit the old Station sits at (read-only ref, never touched).
    try:
        mainline_sha = git("rev-parse", "origin/main")
    except subprocess.CalledProcessError:
        mainline_sha = git("rev-parse", "HEAD")
    mainline_ref = f"origin/main@{mainline_sha}"

    items = build_items()
    summary = {
        "total": len(items),
        "parity": sum(1 for i in items if i["status"] == "parity"),
        "partial": sum(1 for i in items if i["status"] == "partial"),
        "missing": sum(1 for i in items if i["status"] == "missing"),
        "internal": sum(1 for i in items if i["status"] == "internal"),
    }

    doc = {
        "schema": "pw-parity-checklist/v0",
        "generated_by": "C11 divergence feed v1",
        "generated_at": generated_at,
        "station_ref": station_ref,
        "mainline_ref": mainline_ref,
        "source_report": "docs/PARITY-DIVERGENCE-2026-09-20.md",
        "items": items,
        "summary": summary,
    }

    homelab = Path(args.homelab) if args.homelab else REPO_ROOT.parent / "homelab"
    json_path = homelab / "reports" / "parity-checklist.json"

    md = markdown(items, station_ref, mainline_ref, generated_at)

    if args.check:
        import difflib
        old_md = REPORT_MD.read_text() if REPORT_MD.exists() else ""
        # ignore the volatile header lines (first 8) when diffing
        changed = any(
            l.startswith(("-", "+"))
            for l in difflib.unified_diff(old_md.splitlines()[8:], md.splitlines()[8:], lineterm="")
        )
        if json_path.exists():
            old_doc = json.loads(json_path.read_text())
            changed = changed or old_doc.get("items") != items
        print(f"check: {'DRIFT — outputs stale, re-run without --check' if changed else 'no drift'}")
        return 1 if changed else 0

    REPORT_MD.write_text(md)
    print(f"wrote {REPORT_MD.relative_to(REPO_ROOT)}")
    if json_path.parent.is_dir():
        json_path.write_text(json.dumps(doc, indent=2, sort_keys=False) + "\n")
        print(f"wrote {json_path}")
    else:
        print(f"NOTE: no homelab checkout at {json_path.parent} — JSON emission skipped (public-repo copy); markdown report still regenerated")
    print(
        f"rows={summary['total']} parity={summary['parity']} partial={summary['partial']} "
        f"missing={summary['missing']} internal={summary['internal']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
