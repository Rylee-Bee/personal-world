#!/usr/bin/env python3
"""Contract drift check — READ-ONLY report, never writes repo files.

Answers, without mutating anything:

1. spec: does ui/src/generated/openapi.json match a fresh openapi() from
   the live app? (gen-openapi.py is the writer; this is the watcher. The
   dumps call below is kept byte-identical to gen-openapi.py on purpose —
   if someone reformats the writer, this check goes red and points at the
   pair, which is exactly the contract of a drift check.)
2. ghosts: does any curated api_manifest row name a route that is not
   registered? (present:false — must be zero.)
3. coverage: how many live /api routes still have no curated row?
   Reported, never failed: the uncurated tail is a known, named backlog
   (docs/PARITY-CORE-64.md), not drift.

Exit codes: 0 no drift · 1 drift (spec mismatch or ghosts) · 2 the tool
itself failed (app could not boot). No CI wiring: this gate is armed by
Rylee's tap, not by tonight (plan rails).

    uv run --extra crypto python scripts/contract-drift-check.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / "ui" / "src" / "generated" / "openapi.json"
sys.path.insert(0, str(ROOT / "src"))


def main() -> int:
    try:
        from personal_world.api import create_app
        from personal_world.api_manifest import endpoint_manifest
    except Exception as exc:  # import-time failure is a tool failure
        print(f"DRIFT-CHECK ERROR: cannot import app: {exc}", file=sys.stderr)
        return 2

    tmp = Path(tempfile.mkdtemp(prefix="pw-drift-"))
    try:
        app = create_app(data_dir=tmp / "data", config_dir=tmp / "config")
    except Exception as exc:
        print(f"DRIFT-CHECK ERROR: create_app failed: {exc}", file=sys.stderr)
        return 2

    # byte-identical to scripts/gen-openapi.py's serialization
    fresh = json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    committed = SPEC.read_text() if SPEC.exists() else ""
    spec_drift = fresh != committed

    payload = endpoint_manifest(app.routes)
    ghosts = payload["curated_but_not_registered"]
    uncurated = payload["uncurated"]

    def path_count(blob: str) -> str:
        try:
            return str(len(json.loads(blob)["paths"]))
        except (json.JSONDecodeError, KeyError):
            return "unparseable"

    print("contract drift check (read-only)")
    print(f"  spec       : {'DRIFT' if spec_drift else 'in sync'}"
          f" (live paths: {path_count(fresh)},"
          f" committed: {path_count(committed) if committed else 'absent'})")
    print(f"  ghosts     : {'DRIFT' if ghosts else 'none'}"
          f" (curated_but_not_registered: {ghosts or 0})")
    print(f"  uncurated  : {len(uncurated)} live /api routes without a curated row"
          " (report-only; see docs/PARITY-CORE-64.md)")

    if spec_drift or ghosts:
        print("RESULT: DRIFT — run `uv run --extra crypto python scripts/gen-openapi.py`"
              " and/or fix the manifest rows named above")
        return 1
    print("RESULT: CLEAN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
