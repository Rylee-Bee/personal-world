"""P1 T3: multi-stage Dockerfile + .dockerignore (static checks, no docker).

Stage 1 builds frontend/ when present and tolerates its absence; stage 2
is the existing python image with the built dist copied in and
PW_FRONTEND_DIST pointed at it. Since the T15 cutover the React SPA is
the only product frontend — no PW_FRONTEND switch may exist.
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
    def test_frontend_build_stage_present(self):
        assert "FROM node:22-alpine AS frontend" in _dockerfile_text()

    def test_dist_copied_from_build_stage(self):
        assert "COPY --from=frontend /out /app/frontend/dist" in _dockerfile_text()

    def test_dist_env_set(self):
        assert "PW_FRONTEND_DIST=/app/frontend/dist" in _dockerfile_text()

    def test_no_frontend_mode_switch(self):
        # T15 cutover guard: the PW_FRONTEND legacy/react switch is
        # deleted from the product. No ENV may set it, and the serving
        # code must not read it back.
        assert "PW_FRONTEND=" not in _dockerfile_text()
        api_src = (REPO_ROOT / "src" / "personal_world" / "api.py").read_text()
        assert 'os.environ.get("PW_FRONTEND"' not in api_src

    def test_node_stage_tolerates_missing_frontend(self):
        text = _dockerfile_text()
        assert "-f /src/frontend/package.json" in text
        assert "npm ci" in text and "npm run build" in text

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
        for needle in ("**/.env", "**/.env.*", "data/", "config/*.local.json",
                       "config/principal.json", "**/node_modules",
                       "frontend-v2/", ".git", ".venv", "*.log",
                       "design/exports/", ".pytest_cache"):
            assert needle in text, needle