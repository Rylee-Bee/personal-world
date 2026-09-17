"""Decision #19 CLI-parity surface: the manifest-bound CLI wrappers.

Covers the additive registration in ``cli.py`` (``api-manifest``, ``api``,
``do <noun> <verb>``), the one-source-of-truth binding check that runs at
import, and the write-safety contract: a write verb files a durable
proposal and mutates nothing without ``--approve`` AND a step-up token.

The wrappers read their ``kind``/``gate`` from ``api_manifest.py`` — the
same table ``GET /api/manifest`` serves — so these tests also pin that
the surface states its own coverage rather than implying completeness.
"""

import json

from personal_world.cli import main as cli_main
from personal_world.cli_dispatch import (
    DISPATCH_GROUP,
    EXIT_NEEDS_APPROVAL,
    EXIT_UNAVAILABLE,
    MANIFEST_COMMAND,
)


def _run(capsys, tmp_path, argv):
    rc = cli_main(["--data-dir", str(tmp_path), "--config-dir", str(tmp_path), *argv])
    out = capsys.readouterr().out
    return rc, (json.loads(out) if out.strip() else None)


class TestManifestSurface:
    def test_api_manifest_is_the_curated_map(self, tmp_path, capsys):
        rc, env = _run(capsys, tmp_path, [MANIFEST_COMMAND, "--json"])
        assert rc == 0
        assert env["ok"] is True
        data = env["data"]
        assert data["endpoints"], "the map must carry endpoints"
        for row in data["endpoints"]:
            assert {"id", "method", "path", "kind", "gate"} <= set(row)
        # The map declares its own completeness instead of implying it.
        coverage = data["cli"]["coverage"]
        assert coverage["curated_rows"] >= coverage["rows_with_wrapper"]

    def test_legacy_manifest_is_not_clobbered(self, tmp_path, capsys):
        rc, env = _run(capsys, tmp_path, ["manifest", "--json"])
        assert rc == 0
        # `manifest` is cli.py's legacy provider/capability manifest, pinned
        # by tests/test_framework.py::test_core_only_cli_status_and_manifest.
        # The new endpoint map must never have replaced it.
        assert "endpoints" not in env["data"]


class TestDoGroup:
    def test_do_lists_every_wrapper(self, tmp_path, capsys):
        rc, env = _run(capsys, tmp_path, [DISPATCH_GROUP, "--json"])
        assert rc == 0
        commands = env["data"]["commands"]
        assert commands
        assert env["data"]["count"] == len(commands)
        for command in commands:
            assert command["command"].startswith(f"personal-world {DISPATCH_GROUP} ")
            assert command["route"].split()[-1].startswith("/")


class TestWriteSafety:
    def test_write_files_a_proposal_and_mutates_nothing(self, tmp_path, capsys):
        rc, env = _run(
            capsys,
            tmp_path,
            [
                DISPATCH_GROUP,
                "world",
                "intent",
                "--key",
                "demo",
                "--value",
                "hi",
                "--json",
            ],
        )
        assert rc == EXIT_NEEDS_APPROVAL
        assert env["status"] == "proposed"
        assert env["data"]["mutated"] is False

        # The proposal is durable and visible; nothing was written.
        rc2, listed = _run(
            capsys, tmp_path, [DISPATCH_GROUP, "proposals", "list", "--json"]
        )
        assert rc2 == 0
        assert any(p["status"] == "pending" for p in listed["data"])


class TestApiEscapeHatch:
    def test_unreachable_backend_is_honest(self, tmp_path, capsys):
        rc, env = _run(
            capsys,
            tmp_path,
            [
                "api",
                "GET",
                "/api/status",
                "--base",
                "http://127.0.0.1:9",
                "--timeout",
                "0.5",
                "--json",
            ],
        )
        assert rc == EXIT_UNAVAILABLE
        assert env["ok"] is False
        assert env["status"] == "unavailable"
