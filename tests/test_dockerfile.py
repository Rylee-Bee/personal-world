"""The image builds the interface: Dockerfile + .dockerignore static checks.

Owner decision 2026-09-22: the React rebuild IS the product frontend.
The image contains a node stage that builds `ui/` from this repo and
stages it at `src/personal_world/static/app/`; the vanilla Station is no
longer packaged, and no mode switch (PW_FRONTEND*, PW_STATION_DIST) may
exist. Guards here are static (no docker run) — the compose CI job does
the real build.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

REPO_ROOT = Path(__file__).parent.parent


def _dockerfile_text():
    return (REPO_ROOT / "Dockerfile").read_text()


def _dockerignore_text():
    return (REPO_ROOT / ".dockerignore").read_text()


class TestDockerfile:
    def test_ui_build_stage_exists(self):
        text = _dockerfile_text()
        assert "FROM node:" in text
        assert "AS ui-build" in text
        assert "npm ci" in text
        assert "npm run build" in text

    def test_interface_staged_from_stage(self):
        text = _dockerfile_text()
        assert "COPY --from=ui-build /src/ui/dist ./src/personal_world/static/app" in text
        assert "test -f src/personal_world/static/app/index.html" in text

    def test_vanilla_station_not_packaged(self):
        # The retired interface must not come back through the image.
        assert "COPY design/opendesign-exploration/station" not in _dockerfile_text()

    def test_no_mode_switches(self):
        text = _dockerfile_text()
        for banned in ("PW_FRONTEND", "PW_STATION_DIST", "PW_VNEXT_DIST", "PW_FRONTEND_TARGET"):
            assert banned not in text, banned
        api_src = (REPO_ROOT / "src" / "personal_world" / "api.py").read_text()
        assert 'os.environ.get("PW_FRONTEND"' not in api_src

    def test_runtime_stage_unchanged_essentials(self):
        text = _dockerfile_text()
        assert "FROM python:3.12-slim-bookworm" in text
        assert "HEALTHCHECK" in text
        assert "uvicorn personal_world.api:create_app --factory" in text
        assert "FATAL: PW_API_TOKEN is empty or unset" in text
        assert "# TODO: pin by digest" in text


class TestDockerignore:
    def test_private_material_excluded(self):
        text = _dockerignore_text()
        # **/.env is recursive on purpose: ui/.env is read by Vite at
        # build time and inlined into the public bundle.
        for needle in (
            "**/.env",
            "**/.env.*",
            "data/",
            "config/*.local.json",
            "config/principal.json",
            "**/node_modules",
            ".git",
            ".venv",
            "*.log",
            "design/exports/",
            ".pytest_cache",
        ):
            assert needle in text, needle

    def test_local_staged_build_excluded(self):
        # The image's ui-build stage is the only source of static/app;
        # a stale local staging must never ride in via COPY src.
        assert "src/personal_world/static/app/" in _dockerignore_text()
