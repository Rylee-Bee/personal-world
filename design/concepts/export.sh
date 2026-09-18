#!/usr/bin/env sh
# Export the repo's Station concept pages into the LAN showcase directory,
# rewriting the canonical art paths (`../assets/station/...`) to the showcase's
# flat asset layout (`assets/worlds/...`, `assets/characters/...`).
#
# The repo (`design/concepts/`) is the source of truth. `~/showcase/` is the
# served display copy; run this after editing the repo so the two cannot drift.
#
# Usage:   sh design/concepts/export.sh
# Override the destination with SHOWCASE_DIR=/somewhere sh design/concepts/export.sh
set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
dest="${SHOWCASE_DIR:-$HOME/showcase}"

mkdir -p "$dest/assets"

for f in "$here"/*.html; do
	sed -E \
		-e 's#\.\./assets/crew/vector/burrito-journalism\.svg#assets/characters/burrito.svg#g' \
		-e 's#\.\./assets/crew/vector/#assets/characters/#g' \
		-e 's#\.\./assets/crew/cutouts/#assets/characters/#g' \
		-e 's#\.\./assets/station/backgrounds/#assets/worlds/#g' \
		-e 's#\.\./assets/station/characters/#assets/characters/#g' \
		-e 's#\.\./assets/station/icons/#assets/characters/#g' \
		-e 's#\.\./screens/#assets/#g' \
		"$f" >"$dest/$(basename "$f")"
done

# Concept-only assets (thumbnails, display face, a few skies/room photos).
cp -R "$here/assets/." "$dest/assets/"

echo "exported $(ls "$here"/*.html | wc -l) pages + assets to $dest"
