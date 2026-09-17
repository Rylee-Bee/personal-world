"""P1 T3: multi-stage Dockerfile + .dockerignore (static checks, no docker).

Station-only cutover (2026-09-16): the node build stage that turned
``frontend/`` into a served dist is gone. The runtime image is the python
image with the Station's static files and the server-rendered /login and
/setup pages. No ``PW_FRONTEND``/``PW_FRONTEND_DIST`` switch may exist.
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
    def test_no_react_build_stage(self):
        # Station-only cutover: the node stage that built frontend/ is gone.
        assert "FROM node:" not in _dockerfile_text()

    def test_no_dist_copy(self):
        assert "COPY --from=frontend" not in _dockerfile_text()

    def test_no_frontend_dist_env(self):
        assert "PW_FRONTEND_DIST" not in _dockerfile_text()

    def test_no_frontend_mode_switch(self):
        # The PW_FRONTEND legacy/react switch is deleted from the product.
        # No ENV may set it, and the serving code must not read it back.
        assert "PW_FRONTEND=" not in _dockerfile_text()
        api_src = (REPO_ROOT / "src" / "personal_world" / "api.py").read_text()
        assert 'os.environ.get("PW_FRONTEND"' not in api_src

    def test_station_and_server_pages_ship(self):
        text = _dockerfile_text()
        assert "COPY design/opendesign-exploration/station" in text
        assert "COPY src ./src" in text

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
        # **/.env is recursive on purpose: frontend/.env is read by Vite at
        # build time and inlined into the public bundle.
        for needle in (
            "**/.env",
            "**/.env.*",
            "data/",
            "config/*.local.json",
            "config/principal.json",
            "**/node_modules",
            "frontend-v2/",
            ".git",
            ".venv",
            "*.log",
            "design/exports/",
            ".pytest_cache",
        ):
            assert needle in text, needle
