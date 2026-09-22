# TODO: pin by digest after the first build is validated

# --- interface build stage ---------------------------------------------
# The React rebuild IS the product frontend (owner decision 2026-09-22).
# The image builds it from ui/ in this repo — a fresh clone can produce a
# complete, shippable container with no sibling checkouts and no manual
# staging step. The build reads design/tokens.json + design/themes/*.json
# (token generation is cross-directory by design), so both trees are in
# the stage.
FROM node:24-slim AS ui-build
WORKDIR /src
COPY ui/package.json ui/package-lock.json ./ui/
RUN cd ui && npm ci --no-audit --no-fund
COPY design/ ./design/
COPY ui/ ./ui/
RUN cd ui && npm run build

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
# Stage the built interface where app_router() reads it. This is build
# output, not source: .gitignore keeps static/app/ out of git, while
# .dockerignore's `**/dist` drops only raw Vite dirs from the context —
# the COPY --from below is what puts the build into the image.
COPY --from=ui-build /src/ui/dist ./src/personal_world/static/app
RUN test -f src/personal_world/static/app/index.html \
    && echo "interface staged into image: $(ls src/personal_world/static/app | tr '\n' ' ')"
# NOTE on the install dance below: `uv run` (CMD) re-syncs the project
# editable at boot, so `import personal_world` resolves to /app/src/... —
# that is what makes the staged, gitignored static/app visible in the
# container (the non-editable wheel excludes it). Do not delete the src
# tree from the image.
RUN uv pip install --no-cache-dir .

ENV PW_DATA_DIR=/data \
    PW_CONFIG_DIR=/config
# What this image serves: the interface at / (built above), the API at
# /api/*, and server-rendered /login and /setup. The retired /station and
# /vnext paths only redirect to /. The vanilla Station is no longer
# packaged (owner decision 2026-09-22 — one interface, plain and
# responsive, with the starfield color system).

VOLUME /data
VOLUME /config

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
