"""T15 cutover: the React SPA is the ONE product frontend.

The legacy server-rendered pages and the PW_FRONTEND switch are gone.
The server always serves the built SPA (honest 503 when dist is
missing — no legacy fallback UI behind it), API/static routes keep
winning by registration order, traversal cannot escape dist, and no
private value is echoed into any served HTML.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from fastapi.testclient import TestClient  # noqa: E402

TOKEN = "instancetoken-do-not-leak-7f3a"  # pw-safety: synthetic
AUTH = {"Authorization": f"Bearer {TOKEN}"}

INDEX_HTML = (
    "<!doctype html><html><head><title>Project Worlds</title></head>"
    '<body><div id="root" data-marker="fake-dist"></div></body></html>'
)


@pytest.fixture
def fake_dist(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text(INDEX_HTML)
    (dist / "assets" / "app-abc123.js").write_text('console.log("app")')
    (dist / "favicon.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
    return dist


def _app(tmp_path, monkeypatch, dist=None):
    from personal_world.api import create_app
    from personal_world.init import init_world

    monkeypatch.setenv("PW_API_TOKEN", TOKEN)
    monkeypatch.setenv("PW_IDENTITY_MODE", "single")
    monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
    if dist is not None:
        monkeypatch.setenv("PW_FRONTEND_DIST", str(dist))
    init_world(tmp_path, tmp_path)
    (tmp_path / "setup-complete").write_text("ok")
    app = create_app(tmp_path, tmp_path)
    return TestClient(app), app


def _react(tmp_path, monkeypatch, dist):
    return _app(tmp_path, monkeypatch, dist=dist)


class TestSpaIsTheOnlyFrontend:
    def test_serves_index_with_no_cache(self, tmp_path, monkeypatch, fake_dist):
        client, app = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/")
        assert r.status_code == 200
        assert 'data-marker="fake-dist"' in r.text
        assert r.headers["Cache-Control"] == "no-cache"

    def test_spa_fallback_serves_index(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/projects/vefr/anything")
        assert r.status_code == 200
        assert 'data-marker="fake-dist"' in r.text

    def test_auth_pages_return_index(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        for path in ("/setup", "/setup-wizard", "/login"):
            r = client.get(path)
            assert r.status_code == 200, path
            assert 'data-marker="fake-dist"' in r.text, path
            assert r.headers["content-type"].startswith("text/html")

    def test_assets_get_immutable_cache(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/assets/app-abc123.js")
        assert r.status_code == 200
        assert r.text == 'console.log("app")'
        # UAT contract (2026-09-12): no `immutable` — assets must always
        # be revalidatable. ETag revalidation is explicit (this starlette
        # sets the header but has no If-None-Match handling).
        assert "immutable" not in r.headers["Cache-Control"]
        assert "must-revalidate" in r.headers["Cache-Control"]
        assert r.headers.get("etag")

    def test_asset_revalidation_answers_304(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/assets/app-abc123.js")
        etag = r.headers["etag"]
        reval = client.get("/assets/app-abc123.js",
                           headers={"If-None-Match": etag})
        assert reval.status_code == 304
        assert not reval.content
        assert reval.headers["etag"] == etag
        # A stale etag gets the full body again.
        full = client.get("/assets/app-abc123.js",
                          headers={"If-None-Match": '"stale-etag"'})
        assert full.status_code == 200
        assert full.text == 'console.log("app")'

    def test_favicon_served(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/favicon.svg")
        assert r.status_code == 200


class TestLegacyUiCannotReturn:
    """The T15 cutover deleted the legacy HTML. These guards keep it
    deleted: no HTML constants, no PW_FRONTEND mode switch, no legacy
    route handlers — and a stray PW_FRONTEND value in the environment
    must not resurrect anything."""

    def test_no_legacy_html_constants_in_api(self):
        src = (Path(__file__).parent.parent / "src" / "personal_world"
               / "api.py").read_text()
        for name in ("DASHBOARD_HTML", "WIZARD_HTML", "SETUP_HTML",
                     "LOGIN_HTML", "PREFS_STYLE_MARKER"):
            assert name not in src, name

    def test_pw_frontend_env_has_no_effect(self, tmp_path, monkeypatch, fake_dist):
        # The switch is gone: any value (even "legacy") must be inert —
        # the SPA is served regardless. Unknown must never equal a
        # silently resurrected legacy mode.
        monkeypatch.setenv("PW_FRONTEND", "legacy")
        client, app = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/")
        assert r.status_code == 200
        assert 'data-marker="fake-dist"' in r.text
        assert not hasattr(app.state, "frontend_mode")

    def test_no_mode_switch_branch(self, tmp_path, monkeypatch, fake_dist):
        monkeypatch.setenv("PW_FRONTEND", "banana")
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        # Same honest behavior as any other value: the SPA.
        r = client.get("/")
        assert r.status_code == 200
        assert 'data-marker="fake-dist"' in r.text

    def test_unknown_page_is_spa_index_not_404(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/no/such/page")
        assert r.status_code == 200
        assert 'data-marker="fake-dist"' in r.text


class TestApiRoutesNeverSwallowed:
    def test_unknown_api_route_is_json_404(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/api/definitely-not-a-route")
        assert r.status_code == 404
        assert r.headers["content-type"].startswith("application/json")
        assert "not found" in r.json()["detail"]

    def test_api_status_still_works(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/api/status", headers=AUTH)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_healthz_still_works(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/healthz")
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_unauthenticated_api_gets_401_not_index(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/api/sections")
        assert r.status_code == 401
        assert 'data-marker="fake-dist"' not in r.text

    def test_bare_api_path_is_404(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/api")
        assert r.status_code == 404
        assert r.headers["content-type"].startswith("application/json")


class TestStaticRoutesStillWin:
    def test_companion_svg(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/companions/personal-world.svg")
        assert r.status_code == 200
        assert r.headers["content-type"] == "image/svg+xml"

    def test_icon_sprite(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/icons/sprite.svg")
        assert r.status_code == 200


class TestTraversal:
    def test_dotdot_path_cannot_escape_dist(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        secret = tmp_path / "secret.txt"
        secret.write_text("TOP SECRET")
        for path in ("/../secret.txt", "/%2e%2e/secret.txt"):
            r = client.get(path)
            assert r.status_code in (200, 404), path
            assert "TOP SECRET" not in (r.text or "")

    def test_index_404_index_page(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        assert client.get("/").status_code == 200


class TestNoSecretsInHtml:
    def test_index_has_no_token_or_bearer(self, tmp_path, monkeypatch, fake_dist):
        client, _ = _react(tmp_path, monkeypatch, fake_dist)
        r = client.get("/")
        assert TOKEN not in r.text
        assert "Bearer" not in r.text

    def test_503_page_has_no_token_or_bearer(self, tmp_path, monkeypatch):
        empty = tmp_path / "empty-dist"
        empty.mkdir()
        client, _ = _react(tmp_path, monkeypatch, empty)
        r = client.get("/")
        assert TOKEN not in r.text
        assert "Bearer" not in r.text


class TestMissingDist:
    def test_honest_503_without_api_disruption(self, tmp_path, monkeypatch):
        empty = tmp_path / "empty-dist"
        empty.mkdir()
        client, _ = _app(tmp_path, monkeypatch, dist=empty)
        r = client.get("/")
        assert r.status_code == 503
        assert r.headers["content-type"].startswith("text/html")
        assert "interface is not built" in r.text
        assert str(empty) not in r.text
        # API untouched by the missing dist
        assert client.get("/api/status", headers=AUTH).status_code == 200
        assert client.get("/healthz").status_code == 200

    def test_503_page_exact_heading(self, tmp_path, monkeypatch):
        empty = tmp_path / "empty-dist"
        empty.mkdir()
        client, _ = _app(tmp_path, monkeypatch, dist=empty)
        r = client.get("/")
        assert "<h1>Project Worlds' interface is not built</h1>" in r.text

    def test_missing_dist_never_serves_a_legacy_page(self, tmp_path, monkeypatch):
        """The fallback for a missing dist is the honest 503, never a
        retired interface."""
        empty = tmp_path / "empty-dist"
        empty.mkdir()
        client, _ = _app(tmp_path, monkeypatch, dist=empty)
        for path in ("/", "/setup", "/login", "/today", "/settings"):
            r = client.get(path)
            assert r.status_code == 503, path
            assert "interface is not built" in r.text