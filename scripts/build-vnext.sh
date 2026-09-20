#!/usr/bin/env bash
#
# scripts/build-vnext.sh — package the React vNext build into the backend
#
# Reads:    pw-vnext-station/ui/dist/   (a sibling checkout, branch
#           feat/station-vnext-foundation)
# Writes:   src/personal_world/static/vnext/
#
# Why a script and not a git submodule:
#   The React app's source is tracked on its own branch in the sibling
#   checkout. We copy the built artifacts into the backend's static dir
#   for the same reason we copy the Station: it's a build output, not
#   source. This script is the canonical way to update the artifacts.
#
# Why we don't commit the artifacts:
#   The build output is deterministic from the source + Node version +
#   lockfile. Committing it would (a) bloat the repo, (b) cross-pollute
#   a public repo with paths from a private machine, and (c) require a
#   commit on every rebuild. The script is the interface.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIBLING_REPO="${VNEXT_SOURCE:-/home/rylee/code/Rylee-Bee/pw-vnext-station}"
DIST="$SIBLING_REPO/ui/dist"
DEST="$REPO_ROOT/src/personal_world/static/vnext"

if [ ! -d "$DIST" ]; then
    echo "✗ Source build not found: $DIST" >&2
    echo "  Build first:  cd $SIBLING_REPO/ui && npm run build" >&2
    exit 1
fi

if [ ! -f "$DIST/index.html" ]; then
    echo "✗ Build looks incomplete: missing $DIST/index.html" >&2
    exit 1
fi

mkdir -p "$DEST"
# Clean to avoid stale hashed assets (vite emits index-<hash>.js).
rm -rf "$DEST"/*
cp -r "$DIST"/. "$DEST"/

echo "✓ Station vNext build installed at $DEST"
ls "$DEST"
