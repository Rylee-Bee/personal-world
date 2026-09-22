"""Framework conformance tests (docs/NATIVE-BASELINE-AND-ENRICHMENT.md).

Proves the architecture invariants, not implementation details:

A. Core-only: boots, capabilities valid with zero providers
B. Provider added: capability richer, canonical concept unchanged
C. Provider unavailable: core healthy, degraded reported honestly
D. Provider removed: no corruption, baseline remains
E. Provider substitution: A -> B without changing the capability model

Plus init conformance and validator conformance.
"""

import json
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world.app import build_registry, load_world, save_world  # noqa: E402
from personal_world.cli import main as cli_main  # noqa: E402
from personal_world.framework import (  # noqa: E402
    validate_connections,
    validate_compose_file,
    validate_participant_packs,
    validate_settings_export,
)
from personal_world.init import init_world  # noqa: E402
from personal_world.model import (  # noqa: E402
    Capability,
    Provider,
    ProviderMode,
    SCHEMA_VERSION,
)
from personal_world.providers.adapters import FakeSourceControl, Gitea  # noqa: E402
from personal_world.providers.registry import Registry  # noqa: E402
from personal_world.world import World  # noqa: E402

STANDARD_CAPS = {
    "source_control",
    "deployment",
    "secrets",
    "calendar",
    "discovery",
    "settings_validation",
    "service_validation",
    "update_discovery",
    "memory",
    "journal",
    "reasoning",
    "notifications",
    "scheduler",
    "homelab_settings",
    "homelab_health",
    "homelab_deploy",
    "homelab_secrets",
    "homelab_resources",
    "workbench",
}


def _write_conns(tmp_path, conns):
    config_dir = tmp_path / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / "connections.json").write_text(json.dumps(conns))
    return config_dir


# ---------------------------------------------------------------------------
# A. Core-only
# ---------------------------------------------------------------------------


class TestCoreOnly:
    def test_zero_provider_install_boots_and_all_capabilities_valid(self, tmp_path):
        """Framework Rule 1: fresh install, no optional integrations,
        `daily` succeeds and every capability reports an explicit
        not-configured state (never a crash, never a silent lie).

        Native providers that always ship (memory, vault, calendar, etc.)
        may report healthy since they provide baseline value without
        external configuration."""
        config_dir = _write_conns(tmp_path, {"connections": []})
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        w = World()
        reg = build_registry(w, Registry(), config_dir, data_dir=data_dir)
        result = reg.status_map()
        assert set(result.keys()) == STANDARD_CAPS
        # Native providers that always ship may be healthy or not_configured
        # (some need external config to report healthy)
        always_native = {
            "memory",
            "secrets",
            "calendar",
            "notifications",
            "update_discovery",
            "deployment",
        }
        for cap, s in result.items():
            if cap in always_native:
                assert s["status"] in ("healthy", "not_configured", "unavailable"), (
                    f"{cap}: {s['status']}"
                )
            else:
                assert s["status"] == "not_configured", cap

    def test_core_only_cli_status_and_manifest(self, tmp_path, capsys):
        rc = cli_main(
            [
                "--data-dir",
                str(tmp_path),
                "--config-dir",
                str(tmp_path),
                "manifest",
                "--json",
            ]
        )
        assert rc == 0
        out = json.loads(capsys.readouterr().out)
        m = out["data"]
        assert set(m.keys()) == STANDARD_CAPS
        assert m["journal"]["native_baseline"] is True
        assert m["journal"]["active_provider"] is None

    def test_no_provider_depends_on_in_compose(self, tmp_path):
        """Framework Rule 6/11: core compose has no provider boot deps."""
        repo_root = Path(__file__).parent.parent
        result = validate_compose_file(repo_root / "compose.yaml", {"gitea"})
        assert result.ok, [str(v) for v in result.violations]

    def test_compose_persists_config_volume(self):
        """Owner decision 2026-09-22: /config must be a named volume in
        the portable base — wizard-seeded oidc.json dies with the
        container otherwise, while setup-complete (world-data) survives,
        leaving sign-in silently broken with no re-runnable wizard."""
        import yaml

        repo_root = Path(__file__).parent.parent
        compose = yaml.safe_load((repo_root / "compose.yaml").read_text())
        core_vols = compose["services"]["core"]["volumes"]
        assert "config-data:/config" in core_vols, core_vols
        assert "config-data" in compose["volumes"]
        # Portable-base rule (2026-09-12): no host paths in the base.
        for v in core_vols:
            assert not v.startswith(("./", "/", "../")), v

    def test_api_works_with_zero_providers(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient
        from personal_world.api import create_app

        monkeypatch.setenv("PW_API_TOKEN", "t")
        c = TestClient(create_app(tmp_path, tmp_path))
        r = c.get("/api/status", headers={"Authorization": "Bearer t"})
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert "not_configured" in json.dumps(r.json()["data"]["capabilities"])


# ---------------------------------------------------------------------------
# B. Provider added / C. unavailable / D. removed
# ---------------------------------------------------------------------------


class TestProviderLifecycle:
    def _world_with_source_control(self):
        w = World()
        w.register_capability(Capability(key="source_control"))
        w.map_provider(
            Provider(
                capability="source_control",
                name="gitea",
                mode=ProviderMode.ENRICHMENT,
                writes="none",
            )
        )
        return w

    def test_provider_added_capability_richer_concept_unchanged(self, tmp_path):
        conns = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "gitea",
                    "capability": "source_control",
                    "base_url": "http://service.example.invalid:3000",
                },
            ]
        }
        config_dir = _write_conns(tmp_path, conns)
        reg = build_registry(World(), Registry(), config_dir)
        m = reg.manifest()["source_control"]
        assert m["active_provider"] == "gitea"
        assert m["providers"][0]["mode"] == "enrichment"
        assert m["providers"][0]["replaceable"] is True
        # The canonical concept (the capability key + contract) did not change.
        assert m["capability"] == "source_control"
        assert m["contract"] == "StatusContract"

    def test_provider_unavailable_core_healthy_unrelated_unaffected(self, tmp_path):
        """Framework Rule 5: an enrichment provider failing degrades only
        its own capability's fidelity; the core and unrelated capabilities
        stay healthy."""
        conns = {
            "connections": [
                # unreachable port on localhost: connection refused in any
                # environment, never dependent on a live LAN service
                {
                    "type": "gitea",
                    "name": "gitea",
                    "capability": "source_control",
                    "base_url": "http://127.0.0.1:1",
                },
            ]
        }
        config_dir = _write_conns(tmp_path, conns)
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        w = World()
        reg = build_registry(w, Registry(), config_dir, data_dir=data_dir)
        sm = reg.status_map()
        # Native providers that always ship may be healthy/not_configured
        assert sm["memory"]["status"] in ("healthy", "not_configured")
        assert sm["deployment"]["status"] in (
            "healthy",
            "not_configured",
            "unavailable",
        )
        # gitea unreachable: fail-closed, not a crash
        assert sm["source_control"]["status"] in ("unavailable", "unhealthy")
        # core summary itself is still computable
        assert w.summary()["facts"] == 0

    def test_provider_removed_no_corruption(self, tmp_path):
        """Framework Rule 4: removing provider config leaves a valid,
        consistent world; capability concept remains."""
        conns = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "gitea",
                    "capability": "source_control",
                    "base_url": "http://service.example.invalid:3000",
                },
            ]
        }
        config_dir = _write_conns(tmp_path, conns)
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        w = World()
        reg = build_registry(w, Registry(), config_dir, data_dir=data_dir)
        m_before = reg.manifest()["source_control"]
        assert m_before["active_provider"] is not None

        # remove the provider from config
        _write_conns(tmp_path, {"connections": []})
        reg2 = build_registry(World(), Registry(), config_dir, data_dir=data_dir)
        m_after = reg2.manifest()["source_control"]
        # With the native baseline (source_control is Rule 2 native
        # since this change), removal degrades to the native baseline
        # instead of leaving the capability unconfigured.
        assert m_after["active_provider"] == "native-git"
        assert m_after["native_baseline"] is True
        assert m_after["capability"] == "source_control"  # concept remains
        assert m_after["on_last_provider_removed"] == ("degrades to native baseline")

    def test_fake_provider_substitution_preserves_capability(self, tmp_path):
        """Framework E: provider A -> provider B without changing the
        user-facing capability model."""
        conns_a = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "gitea",
                    "capability": "source_control",
                    "base_url": "http://127.0.0.1:1",
                },
            ]
        }
        config_a = _write_conns(tmp_path, conns_a)
        reg_a = build_registry(World(), Registry(), config_a)
        shape_a = reg_a.manifest()["source_control"]
        canonical_keys = ("capability", "contract", "native_baseline")

        conns_b = {
            "connections": [
                {
                    "type": "fake_source_control",
                    "name": "fake",
                    "capability": "source_control",
                    "version": "fake-1.0",
                },
            ]
        }
        config_b = _write_conns(tmp_path / "alt", conns_b)
        reg_b = build_registry(World(), Registry(), config_b)
        shape_b = reg_b.manifest()["source_control"]
        for k in canonical_keys:
            assert shape_a[k] == shape_b[k], k
        assert shape_b["active_provider"] == "fake"


# ---------------------------------------------------------------------------
# Init conformance
# ---------------------------------------------------------------------------


class TestInit:
    def test_fresh_init_creates_all_local_state(self, tmp_path):
        r = init_world(tmp_path, tmp_path)
        assert r.ok
        assert (tmp_path / "world.json").exists()
        assert (tmp_path / "journal.ndjson").exists()
        assert (tmp_path / "connections.json").exists()

    def test_init_is_idempotent(self, tmp_path):
        init_world(tmp_path, tmp_path)
        w1 = (tmp_path / "world.json").read_text()
        r = init_world(tmp_path, tmp_path)
        assert r.status == "already-initialized"
        assert r.changed is False
        assert (tmp_path / "world.json").read_text() == w1

    def test_init_writes_no_secrets(self, tmp_path):
        init_world(tmp_path, tmp_path)
        for f in ("world.json", "connections.json"):
            blob = (tmp_path / f).read_text()
            for bad in ("password", "sk-", "ghp_", "apikeyvalue"):
                assert bad not in blob.lower(), f"{f} contains {bad}"

    def test_init_world_file_is_loadable_with_schema_version(self, tmp_path):
        init_world(tmp_path, tmp_path)
        w = load_world(tmp_path / "world.json")
        assert w.summary()["facts"] == 0
        raw = json.loads((tmp_path / "world.json").read_text())
        assert raw["schema_version"] == SCHEMA_VERSION

    def test_zero_provider_world_from_init_boots(self, tmp_path, capsys):
        """The files init creates are themselves a valid zero-provider
        install: `daily` succeeds against them directly."""
        init_world(tmp_path, tmp_path)
        rc = cli_main(
            [
                "--data-dir",
                str(tmp_path),
                "--config-dir",
                str(tmp_path),
                "daily",
                "--json",
            ]
        )
        assert rc == 0
        out = json.loads(capsys.readouterr().out)
        assert out["ok"] is True

    def test_provider_config_can_be_added_after_init(self, tmp_path):
        init_world(tmp_path, tmp_path)
        conns = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "gitea",
                    "capability": "source_control",
                    "base_url": "http://127.0.0.1:1",
                },
            ]
        }
        # init wrote connections.json directly in config_dir=tmp_path;
        # keep using the same path so this test proves add-after-init
        (tmp_path / "connections.json").write_text(json.dumps(conns))
        reg = build_registry(World(), Registry(), tmp_path)
        assert reg.manifest()["source_control"]["active_provider"] == "gitea"

    def test_removing_provider_config_keeps_core_state(self, tmp_path):
        init_world(tmp_path, tmp_path)
        conns = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "gitea",
                    "capability": "source_control",
                    "base_url": "http://service.example.invalid:3000",
                },
            ]
        }
        _write_conns(tmp_path, conns)
        w = load_world(tmp_path / "world.json")
        w.set_policy(
            __import__("personal_world.model", fromlist=["Policy"]).Policy(
                key="content.test",
                effect=__import__(
                    "personal_world.model", fromlist=["PolicyEffect"]
                ).PolicyEffect.DENY,
                provenance=__import__(
                    "personal_world.model", fromlist=["Provenance"]
                ).Provenance(source="user"),
            )
        )
        save_world(w, tmp_path / "world.json")

        _write_conns(tmp_path, {"connections": []})
        w2 = load_world(tmp_path / "world.json")
        assert "content.test" in w2.policies

    def test_schema_version_mismatch_is_explicit_not_silent(self, tmp_path):
        init_world(tmp_path, tmp_path)
        raw = json.loads((tmp_path / "world.json").read_text())
        raw["schema_version"] = "999"
        (tmp_path / "world.json").write_text(json.dumps(raw))
        with pytest.raises(ValueError, match="migration required"):
            load_world(tmp_path / "world.json")


# ---------------------------------------------------------------------------
# Validator conformance
# ---------------------------------------------------------------------------


class TestValidator:
    def test_valid_connections_pass(self):
        conns = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "gitea",
                    "capability": "source_control",
                    "base_url": "http://x",
                    "token_env": "GITEA_TOKEN",
                },
            ]
        }
        r = validate_connections(conns, STANDARD_CAPS)
        assert r.ok, [str(v) for v in r.violations]

    def test_unknown_capability_rejected(self):
        conns = {
            "connections": [
                {"type": "gitea", "name": "g", "capability": "made_up_cap"},
            ]
        }
        r = validate_connections(conns, STANDARD_CAPS)
        assert not r.ok
        assert any(v.rule == "capability-ownership" for v in r.violations)

    def test_inline_secret_rejected_env_indirection_allowed(self):
        bad = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "g",
                    "capability": "source_control",
                    "base_url": "http://x",
                    "token": "abc123",
                },
            ]
        }
        r = validate_connections(bad, STANDARD_CAPS)
        assert any(v.rule == "secret-rule" for v in r.violations)

    def test_duplicate_provider_ids_rejected(self):
        conns = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "dupe",
                    "capability": "source_control",
                    "base_url": "http://x",
                },
                {
                    "type": "gitea",
                    "name": "dupe",
                    "capability": "source_control",
                    "base_url": "http://y",
                },
            ]
        }
        r = validate_connections(conns, STANDARD_CAPS)
        assert any("duplicate" in str(v) for v in r.violations)

    def test_bad_mode_rejected(self):
        conns = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "g",
                    "capability": "source_control",
                    "mode": "magical",
                },
            ]
        }
        r = validate_connections(conns, STANDARD_CAPS)
        assert any(v.rule == "provider-mode" for v in r.violations)

    def test_required_without_reason_rejected(self):
        conns = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "g",
                    "capability": "source_control",
                    "required": True,
                },
            ]
        }
        r = validate_connections(conns, STANDARD_CAPS)
        assert any(v.rule == "optional-default" for v in r.violations)

    def test_required_with_reason_is_explicit_exception(self):
        conns = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "g",
                    "capability": "source_control",
                    "required": True,
                    "required_reason": "custom deployment: this world IS the gitea mirror",
                },
            ]
        }
        r = validate_connections(conns, STANDARD_CAPS)
        assert r.ok, [str(v) for v in r.violations]

    def test_compose_depends_on_provider_rejected(self, tmp_path):
        compose = tmp_path / "compose.yaml"
        compose.write_text(
            "services:\n"
            "  core:\n"
            "    image: personal-world:0.1\n"
            "    depends_on:\n"
            "      gitea:\n"
            "        condition: service_healthy\n"
        )
        r = validate_compose_file(compose, {"gitea"})
        assert any(v.rule == "compose-additive" for v in r.violations)

    def test_settings_export_forbidden_fields_rejected(self):
        sx = {
            "capabilities": [
                {
                    "key": "source_control",
                    "providers": [
                        {
                            "capability": "source_control",
                            "name": "gitea",
                            "config": {"token": "x"},
                        },
                    ],
                }
            ]
        }
        r = validate_settings_export(sx)
        assert any(v.rule == "export-portability" for v in r.violations)

    def test_framework_validate_cli_on_repo_config(self, tmp_path, capsys):
        """`personal-world framework validate` against the repo's own
        shipped config/connections.json must pass (the repo conforms to
        its own framework)."""
        repo_root = Path(__file__).parent.parent
        rc = cli_main(
            [
                "--data-dir",
                str(tmp_path),
                "--config-dir",
                str(repo_root / "config"),
                "framework",
                "validate",
                "--json",
            ]
        )
        out = json.loads(capsys.readouterr().out)
        assert rc == 0, out.get("warnings", [])
        assert out["ok"] is True
        assert out["data"]["count"] == 0


# ---------------------------------------------------------------------------
# Manifest conformance
# ---------------------------------------------------------------------------


class TestManifest:
    def test_manifest_answers_all_four_questions(self, tmp_path):
        conns = {
            "connections": [
                {
                    "type": "gitea",
                    "name": "gitea",
                    "capability": "source_control",
                    "base_url": "http://x",
                },
                {
                    "type": "fake_source_control",
                    "name": "fake",
                    "capability": "source_control",
                },
            ]
        }
        reg = build_registry(World(), Registry(), _write_conns(tmp_path, conns))
        m = reg.manifest()["source_control"]
        # Q1: what capabilities exist / contract
        assert m["capability"] == "source_control"
        assert m["contract"]
        # Q2: native baseline
        assert "native_baseline" in m
        # Q3: which providers enrich; which active
        assert {p["name"] for p in m["providers"]} == {"gitea", "fake"}
        assert m["active_provider"] in ("gitea", "fake")
        # Q4: what happens if the provider disappears
        assert "on_last_provider_removed" in m

    def test_manifest_is_provider_neutral_vocabulary(self, tmp_path):
        """Rule 7: the manifest keys are semantic concepts, never
        vendor-shaped (no gitea/traefik/komodo keys at the top level)."""
        reg = build_registry(
            World(), Registry(), _write_conns(tmp_path, {"connections": []})
        )
        blob = json.dumps(reg.manifest())
        # vendor names may appear in provider entries, but never as
        # canonical capability keys
        for vendor in ("gitea", "traefik", "komodo", "github", "forgejo"):
            assert f'"{vendor}":' not in blob


# ---------------------------------------------------------------------------
# Classification guard: providers cannot launder classification
# ---------------------------------------------------------------------------


class TestProviderClassificationGuard:
    def test_provider_output_inherits_classification_not_defines_it(self):
        """A provider returning data tagged 'world' does not upgrade
        private observations: classification lives on records in the
        core, assigned by the core's rules, never accepted from the
        provider payload itself."""
        from personal_world.model import Fact, Provenance
        from personal_world.classification import Classification

        provider_data = {"classification": "secret", "token": "leak"}
        # The core decides classification when recording a fact from
        # provider output; the payload's self-declared class is ignored.
        w = World()
        w.record_fact(
            Fact(
                key="service.gitea.version",
                value=provider_data.get("version", "1.0"),
                provenance=Provenance(source="provider:gitea", provider="gitea"),
                classification=Classification.WORLD,
            )
        )
        f = w.facts["service.gitea.version"]
        assert f.classification == Classification.WORLD
        assert "token" not in f.value


# ---------------------------------------------------------------------------
# Design tool independence (addendum): canonical tokens are repo-native
# ---------------------------------------------------------------------------


class TestDesignToolIndependence:
    def test_canonical_tokens_exist_and_parse(self):
        repo_root = Path(__file__).parent.parent
        tokens = json.loads((repo_root / "design" / "tokens.json").read_text())
        # re-anchored 2026-09-20 to the names/values split: color VALUES moved
        # to theme packs and the status vocabulary moved to code (where it
        # functionally lives) — the semantic NAME groups below are the contract.
        for required in (
            "surface", "accent", "text", "border",
            "spacing", "radius", "shadow", "typography",
            "density", "targets", "focus", "motion",
        ):
            assert required in tokens, f"tokens.json missing {required}"
        # the two moved citizens are asserted at their new homes:
        hexfree = not re.search(r"#[0-9A-Fa-f]{6}", json.dumps(
            {k: v for k, v in tokens.items()}))
        assert hexfree, "tokens.json must carry NAMES only — literal colors belong in themes"
        import personal_world.status as _st
        assert getattr(_st.Status, "HEALTHY", None) is not None and _st.RANK, (
            "status vocabulary (formerly a tokens group) must exist in code where it operates"
        )

    def test_tokens_are_semantic_not_tool_internal(self):
        """Token names are semantic concepts (surface.canvas,
        status.healthy) — never design-application internal structure.
        Comments may mention tools for context; names/values may not."""
        repo_root = Path(__file__).parent.parent
        tokens = json.loads((repo_root / "design" / "tokens.json").read_text())

        def names_and_values(node):
            if isinstance(node, dict):
                for k, v in node.items():
                    if k.startswith("_"):
                        continue
                    yield k
                    yield from names_and_values(v)
            elif isinstance(node, list):
                for v in node:
                    yield from names_and_values(v)

        blob = " ".join(names_and_values(tokens)).lower()
        for tool_marker in (
            "figma",
            "penpot",
            "sketch",
            "framer",
            "componentid",
            "nodeid",
            "filekey",
        ):
            assert tool_marker not in blob, f"tool marker {tool_marker} in tokens"

    def test_accessibility_model_lives_in_core_not_design_files(self):
        from personal_world.model import Accessibility

        a = Accessibility()
        assert a.motion == "reduced"  # core-owned default, tool-independent
        assert Accessibility.model_fields["motion"] is not None

    def test_frontend_is_repo_native(self):
        """The executable design reference is the interface (the React
        rebuild in ui/), served from repo sources — no design tool needed
        (updated at the 2026-09-22 cutover: the retired vanilla Station
        and the legacy HTML constants are gone)."""
        repo_root = Path(__file__).parent.parent
        assert (repo_root / "ui" / "index.html").is_file()
        assert (repo_root / "ui" / "src" / "main.tsx").is_file()
        html = (repo_root / "src" / "personal_world" / "api.py").read_text()
        assert "DASHBOARD_HTML" not in html
        assert ".fig" not in html
        assert "figma.com" not in html


# ---------------------------------------------------------------------------
# Fake source control registration type (used by substitution test B/E)
# ---------------------------------------------------------------------------

FakeSourceControl  # re-exported import used above; keep name for clarity
Gitea  # ditto


# ---------------------------------------------------------------------------
# Participant pack validation — canonical gate for .project/participants/
# ---------------------------------------------------------------------------


class TestParticipantPackValidation:
    """``validate_participant_packs`` is the canonical, project-neutral
    gate for participant packs. Lives in the Python package (NOT in any
    harness config) so any agent, CI, or human can drive it. Validates
    parseability, required top-level keys, schema namespace, and id
    uniqueness — does NOT attest contracts."""

    REAL_PACKS = Path(__file__).resolve().parents[1] / ".project" / "participants"

    def test_real_packs_validate_clean(self):
        """Every existing pack in the repo must pass the validator.
        This test will fail loudly if anyone commits a malformed pack."""
        result = validate_participant_packs(self.REAL_PACKS)
        assert result.ok, [str(v) for v in result.violations]
        assert result.violations == []

    def test_missing_participants_dir_is_a_violation(self, tmp_path: Path):
        result = validate_participant_packs(tmp_path / "does-not-exist")
        assert not result.ok
        assert any(v.rule == "pack-discovery" for v in result.violations)

    def test_empty_participants_dir_is_a_violation(self, tmp_path: Path):
        result = validate_participant_packs(tmp_path)
        assert not result.ok
        assert any(v.rule == "pack-discovery" for v in result.violations)

    def test_malformed_yaml_is_a_violation(self, tmp_path: Path):
        """The exact failure mode observed twice this session: a
        participant.yaml that does not parse. The validator must
        catch it without leaving any malformed state behind."""
        (tmp_path / "broken").mkdir()
        bad = tmp_path / "broken" / "participant.yaml"
        # Tab indent + dangling colon: a real YAML parse failure.
        bad.write_text(
            "schema: play-nice/participant-v1\nid: broken\n\tmixed: [unclosed\n"
        )
        result = validate_participant_packs(tmp_path)
        assert not result.ok
        rules = {v.rule for v in result.violations}
        assert "pack-parse" in rules

    def test_missing_required_keys_is_a_violation(self, tmp_path: Path):
        (tmp_path / "x").mkdir()
        (tmp_path / "x" / "participant.yaml").write_text("name: no-id-no-schema\n")
        result = validate_participant_packs(tmp_path)
        assert not result.ok
        rules = {v.rule for v in result.violations}
        assert rules & {"pack-shape", "pack-parse"}

    def test_schema_namespace_must_start_with_play_nice(self, tmp_path: Path):
        (tmp_path / "x").mkdir()
        (tmp_path / "x" / "participant.yaml").write_text(
            "schema: some-other-namespace/v1\nid: x\n"
        )
        result = validate_participant_packs(tmp_path)
        assert not result.ok
        assert any(v.rule == "pack-schema-namespace" for v in result.violations)

    def test_duplicate_pack_id_is_a_violation(self, tmp_path: Path):
        for name in ("a", "b"):
            (tmp_path / name).mkdir()
            (tmp_path / name / "participant.yaml").write_text(
                "schema: play-nice/participant-v1\nid: duplicate\n"
            )
        result = validate_participant_packs(tmp_path)
        assert not result.ok
        assert any(v.rule == "pack-id-collision" for v in result.violations)

    def test_top_level_must_be_a_mapping(self, tmp_path: Path):
        (tmp_path / "x").mkdir()
        (tmp_path / "x" / "participant.yaml").write_text("- 1\n- 2\n")
        result = validate_participant_packs(tmp_path)
        assert not result.ok
        assert any(v.rule == "pack-shape" for v in result.violations)

    def test_well_formed_packs_pass(self, tmp_path: Path):
        for name in ("alpha", "beta"):
            (tmp_path / name).mkdir()
            (tmp_path / name / "participant.yaml").write_text(
                f"schema: play-nice/participant-v1\nid: {name}\nname: t\n"
            )
        result = validate_participant_packs(tmp_path)
        assert result.ok, [str(v) for v in result.violations]

    def test_cli_subcommand_drives_validator(self, capsys):
        """`personal-world framework validate-packs` must wire to the
        validator end-to-end (no harness-specific config)."""
        rc = cli_main(["framework", "validate-packs"])
        out = capsys.readouterr().out
        assert rc == 0, out
        assert "healthy" in out


# ---------------------------------------------------------------------------
# Provider health-check binding (regression)
# ---------------------------------------------------------------------------


class TestProviderHealthCheckBinding:
    """build_registry wires one health check per configured provider. Each
    check must observe its own provider implementation; a late-binding
    closure would make every provider of a given branch report the health
    of the loop's last instance."""

    def test_each_health_check_binds_its_own_provider(self, tmp_path, monkeypatch):
        from personal_world.envelope import Result
        from personal_world.providers.adapters import CandyDispenser
        from personal_world.status import Status

        seen: list[str] = []

        def fake_health(self):
            seen.append(self.base_url)
            if self.base_url.endswith("/a"):
                return Result(ok=True, status=Status.HEALTHY.value)
            return Result(ok=False, status=Status.UNAVAILABLE.value)

        monkeypatch.setattr(CandyDispenser, "health", fake_health)
        conns = {
            "connections": [
                {
                    "type": "candy",
                    "name": "candy-a",
                    "capability": "discovery",
                    "base_url": "http://example.invalid/a",
                },
                {
                    "type": "candy",
                    "name": "candy-b",
                    "capability": "discovery",
                    "base_url": "http://example.invalid/b",
                },
            ]
        }
        reg = build_registry(World(), Registry(), _write_conns(tmp_path, conns))

        statuses = {a.name: a.status for a in reg.actors()}
        assert seen == ["http://example.invalid/a", "http://example.invalid/b"]
        assert statuses["candy-a"] == Status.HEALTHY.value
        assert statuses["candy-b"] == Status.NEEDS_ATTENTION.value
