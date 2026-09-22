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
#
# Production image chain (side-by-side vNext at /vnext/):
#   1. cd "$VNEXT_SOURCE/ui" && npm run build
#   2. VNEXT_SOURCE=<path to pw-vnext-station checkout> bash scripts/build-vnext.sh
#      (run from this repo root; stages src/personal_world/static/vnext/)
#   3. docker build --load -t <your local tag> .
#      The staged dir is gitignored but NOT dockerignored: .dockerignore
#      excludes only raw `**/dist` dirs, and the Dockerfile's `COPY src`
#      carries static/vnext into the image, where the app serves /vnext/.
#
# Asset-base caveat: the React build must emit a /vnext/-prefixed base
#   (vite `base: '/vnext/'`) for its asset URLs to resolve under the mount.
#   A root-absolute build is served fine at /vnext/ itself, but its
#   /assets/* fetches will 404. Owning lane: frontend.
#
# Cutover policy: this is additive. Promoting /vnext/ to /station/ (and
#   retiring the vanilla Station) happens ONLY after the navigation
#   skeleton is accepted — see the Dockerfile note and the env-var gate
#   (e.g. PW_FRONTEND_TARGET, default = current side-by-side behavior).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# VNEXT_SOURCE is required: no personal default paths in tracked scripts
# (tests/test_public_safety.py enforces this; see .project contract too).
SIBLING_REPO="${VNEXT_SOURCE:?set VNEXT_SOURCE to your local pw-vnext-station checkout}"
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
