# TODO: pin by digest after the first build is validated

# --- runtime stage ----------------------------------------------------
# TODO: pin by digest after the first build is validated
FROM python:3.12-slim-bookworm

# git: source-control capability feeds the dashboard + chat context.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git jq curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
RUN pip install --no-cache-dir uv \
    && uv sync --frozen --no-dev --extra test --extra crypto \
    && rm -rf ~/.cache

COPY src ./src
# --- Station vNext (React UI) packaging -------------------------------
# The vNext build is staged into src/personal_world/static/vnext/ BEFORE
# `docker build` runs; the `COPY src` above carries it into the image.
# It is build output, not source: .gitignore keeps it out of git on
# purpose, while .dockerignore's `**/dist` drops only raw Vite output
# dirs — never the staged copy (no `dist` segment in that path).
# Canonical staging command, run from this repo root with a local
# pw-vnext-station checkout (no machine-specific path is baked into
# any tracked file; the value is supplied by the operator):
#
#   VNEXT_SOURCE=<path to pw-vnext-station checkout> bash scripts/build-vnext.sh
#
# If staging was skipped the build still succeeds and /vnext/ serves the
# honest "not installed" page (station_ui.vnext_router); the check below
# makes that case loud in the build log instead of silent.
RUN if [ -f src/personal_world/static/vnext/index.html ]; then \
      echo 'vnext build staged at src/personal_world/static/vnext:' \
      && ls src/personal_world/static/vnext; \
    else \
      echo 'WARNING: no vnext build staged — /vnext/ will serve the "not' \
      'installed" page. Run scripts/build-vnext.sh before docker build' \
      'to ship the React UI.' >&2; \
    fi
# The Station is the product frontend (decision #11). Package it at the path
# default_station_dir() resolves to inside the image (/app/design/...), so
# /station/ works same-origin with no machine-specific path and no env override.
COPY design/opendesign-exploration/station ./design/opendesign-exploration/station
# NOTE on the install dance below: `uv run` (CMD) re-syncs the project
# editable at boot, so `import personal_world` resolves to /app/src/... —
# that is what makes the staged, gitignored static/vnext visible in the
# container (the non-editable wheel excludes it, and only site-packages
# copies would break default_station_dir()'s /app/design path). Do not
# delete the src tree from the image; both frontends depend on it.
RUN uv pip install --no-cache-dir .

ENV PW_DATA_DIR=/data \
    PW_CONFIG_DIR=/config
# What this image serves: the vanilla Station at /station/ (product
# frontend, ships via COPY above), the Station vNext React build side-by-side
# at /vnext/ when staged (see above), and server-rendered /login and /setup.
# Cutover policy: promoting vNext from /vnext/ to /station/ — retiring the
# vanilla Station — happens ONLY after the navigation skeleton is accepted
# by the owner. It is NOT done here; when it is, gate the flip behind an
# env var (e.g. PW_FRONTEND_TARGET) defaulting to the current side-by-side
# behavior, so /station/ never changes silently.

VOLUME /data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys,os; \
        r=urllib.request.urlopen('http://127.0.0.1:8000/healthz',timeout=4); \
        sys.exit(0 if r.status==200 else 1)"

# Fail fast at runtime when auth is unconfigured: an empty PW_API_TOKEN
# must never serve (core already 503s protected routes; this makes the
# boot itself loud). Compose parses without the token; the container
# does not.
CMD ["sh", "-c", \
     "test -n \"$PW_API_TOKEN\" || { echo 'FATAL: PW_API_TOKEN is empty or unset; refusing to boot (auth is fail-closed).' >&2; exit 1; }; \
      exec uv run uvicorn personal_world.api:create_app --factory \
       --proxy-headers --forwarded-allow-ips='*' \
       --host 0.0.0.0 --port 8000"]