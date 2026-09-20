#!/usr/bin/env python3
"""S2: regenerate ui/src/generated/openapi.json from the LIVE app.

The committed spec went 54-paths stale because nothing could be rebuilt
reproducibly — app.openapi() had been silently broken by a route annotation
(worlds_backup FileResponse). One command now, run it whenever routes
change; CI gate for this is D5 (arming pending):

    uv run --extra crypto python scripts/gen-openapi.py
"""
import json, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from personal_world.api import create_app  # noqa: E402

tmp = Path(tempfile.mkdtemp())
spec = create_app(data_dir=tmp / "data", config_dir=tmp / "config").openapi()
out = Path(__file__).resolve().parent.parent / "ui" / "src" / "generated" / "openapi.json"
out.write_text(json.dumps(spec, indent=2, sort_keys=True, ensure_ascii=False) + "\n")
print(f"regenerated {out} — {len(spec['paths'])} paths from live routes")
