"""The Station served same-origin (product decision #12).

`station_ui.py` mounts the Station map at `/station` so the browser
session cookie authenticates its API calls with no CORS anywhere. These
tests guard the boundaries that make that safe:

* first-run wins — before the setup marker, every path redirects to
  `/setup`, so a half-built world is never presented as a working one;
* authorization is the canonical seam — an unauthenticated browser is
  redirected to `/login`, and a valid `pw_session` cookie is enough
  (that is the whole point of same-origin serving);
* the served set is an allowlist: traversal cannot escape, internal
  notes (`.md`) and archived explorations (`_legacy/`) are never served;
* a deployment without the Station artifact says so plainly and never
  echoes a filesystem path.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from fastapi.testclient import TestClient  # noqa: E402

from personal_world.station_ui import (  # noqa: E402
    STATION_PREFIX,
    build_allowlist,
    default_station_dir,
)

TOKEN = "instancetoken-do-not-leak-9a2e"  # pw-safety: synthetic
AUTH = {"Authorization": f"Bearer {TOKEN}"}

INDEX = (
    "<!doctype html><html><head><title>Station</title></head>"
    '<body><main id="main">systems map marker</main></body></html>'
)


@pytest.fixture
def station(tmp_path):
    """A small, deterministic Station stand-in."""
    root = tmp_path / "station"
    (root / "_legacy").mkdir(parents=True)
    root.joinpath("index.html").write_text(INDEX)
    root.joinpath("station.css").write_text("body { color: #fff; }")
    root.joinpath("api.js").write_text("window.PW_API = {};")
    root.joinpath("manifest.json").write_text('{"name":"Station"}')
    root.joinpath("icon-192.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    # must never be served: internal notes and archived explorations
    root.joinpath("HANDOFF.md").write_text("internal 192.0.2.7 note")
    root.joinpath("_legacy", "workshop.html").write_text("legacy deck")
    # a sibling secret outside the station root
    (tmp_path / "secret.txt").write_text("TOP SECRET")
    return root


def _client(tmp_path, monkeypatch, station_dir, setup_done=True):
    from personal_world.api import create_app
    from personal_world.init import init_world

    monkeypatch.setenv("PW_API_TOKEN", TOKEN)
    monkeypatch.setenv("PW_IDENTITY_MODE", "single")
    monkeypatch.setenv("PW_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("PW_CONFIG_DIR", str(tmp_path))
    if station_dir is not None:
        monkeypatch.setenv("PW_STATION_DIST", str(station_dir))
    init_world(tmp_path, tmp_path)
    marker = tmp_path / "setup-complete"
    if setup_done:
        marker.write_text("ok")
    else:
        marker.unlink(missing_ok=True)
    return TestClient(create_app(tmp_path, tmp_path))


@pytest.fixture
def client(tmp_path, monkeypatch, station):
    return _client(tmp_path, monkeypatch, station)


def _session(client) -> dict:
    """A real browser session, presented the way a browser presents it.

    The cookie is `Secure`, and the test client speaks plain http, so the
    jar will not send it; the header is set explicitly. That is a test
    transport detail, not a product shortcut — over HTTPS (or on
    localhost) the browser sends it itself.
    """
    response = client.post("/api/auth/login", json={"token": TOKEN})
    assert response.status_code == 200
    sid = response.json()["data"]["session_id"]
    return {"Cookie": f"pw_session={sid}"}


class TestGate:
    def test_first_run_redirects_to_setup(self, tmp_path, monkeypatch, station):
        c = _client(tmp_path, monkeypatch, station, setup_done=False)
        for path in (
            STATION_PREFIX,
            f"{STATION_PREFIX}/",
            f"{STATION_PREFIX}/station.css",
        ):
            r = c.get(path, headers=AUTH, follow_redirects=False)
            assert r.status_code == 303, path
            assert r.headers["location"] == "/setup", path

    def test_unauthenticated_redirects_to_login(self, client):
        for path in (STATION_PREFIX, f"{STATION_PREFIX}/", f"{STATION_PREFIX}/api.js"):
            r = client.get(path, follow_redirects=False)
            assert r.status_code == 303, path
            assert r.headers["location"] == "/login", path

    def test_bare_prefix_redirects_to_the_map(self, client):
        r = client.get(STATION_PREFIX, headers=AUTH, follow_redirects=False)
        assert r.status_code == 303
        assert r.headers["location"] == f"{STATION_PREFIX}/"

    def test_session_cookie_is_enough(self, client):
        """Same-origin serving is the point: a signed-in browser needs no
        bearer token and no CORS exception."""
        headers = _session(client)
        r = client.get(f"{STATION_PREFIX}/", headers=headers)
        assert r.status_code == 200
        assert "systems map marker" in r.text
        # …and that same session reads the API it composes against.
        assert client.get("/api/proposals", headers=headers).status_code == 200

    def test_bearer_also_works(self, client):
        assert client.get(f"{STATION_PREFIX}/", headers=AUTH).status_code == 200

    def test_a_bad_session_is_redirected_not_served(self, client):
        r = client.get(
            f"{STATION_PREFIX}/",
            headers={"Cookie": "pw_session=not-a-real-session"},
            follow_redirects=False,
        )
        assert r.status_code == 303
        assert r.headers["location"] == "/login"


class TestServing:
    def test_index_and_assets(self, client):
        cases = {
            f"{STATION_PREFIX}/": ("text/html", "systems map marker"),
            f"{STATION_PREFIX}/index.html": ("text/html", "systems map marker"),
            f"{STATION_PREFIX}/station.css": ("text/css", "color"),
            f"{STATION_PREFIX}/api.js": ("text/javascript", "PW_API"),
            f"{STATION_PREFIX}/manifest.json": ("application/json", "Station"),
        }
        for path, (ctype, needle) in cases.items():
            r = client.get(path, headers=AUTH)
            assert r.status_code == 200, path
            assert r.headers["content-type"].startswith(ctype), path
            assert needle in r.text, path

    def test_binary_asset_served(self, client):
        r = client.get(f"{STATION_PREFIX}/icon-192.png", headers=AUTH)
        assert r.status_code == 200
        assert r.headers["content-type"] == "image/png"

    def test_assets_revalidate_never_immutable(self, client):
        path = f"{STATION_PREFIX}/station.css"
        r = client.get(path, headers=AUTH)
        assert "immutable" not in r.headers["Cache-Control"]
        assert "must-revalidate" in r.headers["Cache-Control"]
        etag = r.headers.get("etag")
        assert etag
        reval = client.get(path, headers={**AUTH, "If-None-Match": etag})
        assert reval.status_code == 304
        assert not reval.content

    def test_unknown_file_is_an_honest_404(self, client):
        r = client.get(f"{STATION_PREFIX}/nope.html", headers=AUTH)
        assert r.status_code == 404
        assert "not part of the Station" in r.text


class TestAllowlist:
    def test_internal_notes_are_never_served(self, client):
        r = client.get(f"{STATION_PREFIX}/HANDOFF.md", headers=AUTH)
        assert r.status_code == 404
        assert "192.0.2.7" not in r.text

    def test_legacy_archive_is_not_part_of_the_nav(self, client):
        r = client.get(f"{STATION_PREFIX}/_legacy/workshop.html", headers=AUTH)
        assert r.status_code == 404
        assert "legacy deck" not in r.text

    def test_allowlist_excludes_notes_and_archives(self, station):
        allow = build_allowlist(station)
        assert "index.html" in allow
        assert not any(key.endswith(".md") for key in allow)
        assert not any(key.startswith("_") for key in allow)

    def test_allowlist_of_a_missing_dir_is_empty(self, tmp_path):
        assert build_allowlist(tmp_path / "absent") == {}

    @pytest.mark.parametrize(
        "path",
        [
            "/../secret.txt",
            "/%2e%2e/secret.txt",
            "/..%2fsecret.txt",
        ],
    )
    def test_traversal_cannot_escape(self, client, path):
        r = client.get(f"{STATION_PREFIX}{path}", headers=AUTH, follow_redirects=False)
        assert r.status_code in (200, 303, 404), path
        assert "TOP SECRET" not in (r.text or "")


class TestHonestAbsence:
    def test_missing_artifact_reports_503_without_leaking_a_path(
        self, tmp_path, monkeypatch
    ):
        absent = tmp_path / "no-station-here"
        c = _client(tmp_path, monkeypatch, absent)
        r = c.get(f"{STATION_PREFIX}/", headers=AUTH)
        assert r.status_code == 503
        assert "Station is not installed here" in r.text
        assert str(absent) not in r.text
        assert str(tmp_path) not in r.text
        # the API is unaffected
        assert c.get("/api/status", headers=AUTH).status_code == 200
        assert c.get("/healthz").status_code == 200

    def test_default_location_is_the_design_directory(self):
        assert (
            default_station_dir()
            .as_posix()
            .endswith("design/opendesign-exploration/station")
        )


class TestRepositoryStation:
    """The real in-repo Station must actually be servable — the design
    directory is untracked/edited by hand, so this is the integration
    check that the shipped artifact still meets the allowlist rules."""

    @pytest.fixture
    def repo_station(self):
        root = default_station_dir()
        if not root.is_dir():
            pytest.skip("Station design directory not present")
        return root

    def test_index_and_client_are_servable(self, repo_station):
        allow = build_allowlist(repo_station)
        for name in (
            "index.html",
            "station.css",
            "api.js",
            "real-data.js",
            "real-data.css",
        ):
            assert name in allow, f"{name} would not be served"

    def test_no_internal_notes_or_archives(self, repo_station):
        allow = build_allowlist(repo_station)
        assert not any(key.endswith(".md") for key in allow)
        assert not any(
            part.startswith(("_", ".")) for key in allow for part in key.split("/")
        )

    def test_served_files_carry_no_private_topology(self, repo_station):
        """The design directory holds handoff notes with a real LAN
        address. Notes are excluded above; this proves nothing servable
        carries private topology either."""
        markers = (
            "192.168.",  # pw-safety: synthetic
            "hulganfamily",  # pw-safety: synthetic
            "10.0.",  # pw-safety: synthetic
            "172.16.",  # pw-safety: synthetic
        )  # pw-safety: synthetic
        allow = build_allowlist(repo_station)
        findings = []
        for key, path in allow.items():
            if path.suffix.lower() not in (
                ".html",
                ".css",
                ".js",
                ".json",
                ".svg",
                ".txt",
            ):
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            findings += [f"{key}: {m}" for m in markers if m in text]
        assert not findings, "; ".join(findings)
