"""Tests for connection manager and provider schemas."""

import json
from pathlib import Path

import pytest

from personal_world.connection_manager import ConnectionManager
from personal_world.provider_schemas import (
    CAPABILITY_SCHEMAS,
    get_capability_schema,
    get_capability_schemas,
)


class TestConnectionManager:
    def test_read_empty(self, tmp_path: Path) -> None:
        mgr = ConnectionManager(tmp_path)
        assert mgr.get_connections() == []
        assert mgr.get_native_config("calendar") == {}

    def test_save_connection(self, tmp_path: Path) -> None:
        mgr = ConnectionManager(tmp_path)
        mgr.save_connection({"type": "plex", "name": "my-plex", "capability": "media", "base_url": "http://plex"})
        conns = mgr.get_connections()
        assert len(conns) == 1
        assert conns[0]["name"] == "my-plex"

    def test_save_connection_replaces_by_name(self, tmp_path: Path) -> None:
        mgr = ConnectionManager(tmp_path)
        mgr.save_connection({"type": "plex", "name": "my-plex", "base_url": "http://old"})
        mgr.save_connection({"type": "plex", "name": "my-plex", "base_url": "http://new"})
        conns = mgr.get_connections()
        assert len(conns) == 1
        assert conns[0]["base_url"] == "http://new"

    def test_delete_connection(self, tmp_path: Path) -> None:
        mgr = ConnectionManager(tmp_path)
        mgr.save_connection({"type": "plex", "name": "my-plex"})
        assert mgr.delete_connection("my-plex") is True
        assert mgr.get_connections() == []
        assert mgr.delete_connection("nonexistent") is False

    def test_save_native_config(self, tmp_path: Path) -> None:
        mgr = ConnectionManager(tmp_path)
        mgr.save_native_config("calendar", {"sources": [{"type": "ics", "url": "http://cal"}]})
        cal = mgr.get_native_config("calendar")
        assert cal["sources"][0]["url"] == "http://cal"

    def test_local_overrides_tracked(self, tmp_path: Path) -> None:
        # Write tracked config
        tracked = {"connections": [{"type": "ollama", "name": "brain", "capability": "reasoning"}]}
        (tmp_path / "connections.json").write_text(json.dumps(tracked))
        # Write local config
        local = {"connections": [{"type": "plex", "name": "my-plex", "capability": "media"}]}
        (tmp_path / "connections.local.json").write_text(json.dumps(local))
        mgr = ConnectionManager(tmp_path)
        conns = mgr.get_connections()
        assert len(conns) == 2
        names = {c["name"] for c in conns}
        assert names == {"brain", "my-plex"}

    def test_local_native_config_overrides_tracked(self, tmp_path: Path) -> None:
        tracked = {"calendar": {"sources": [{"type": "ics", "url": "http://old"}]}}
        (tmp_path / "connections.json").write_text(json.dumps(tracked))
        local = {"calendar": {"sources": [{"type": "ics", "url": "http://new"}]}}
        (tmp_path / "connections.local.json").write_text(json.dumps(local))
        mgr = ConnectionManager(tmp_path)
        cal = mgr.get_native_config("calendar")
        assert cal["sources"][0]["url"] == "http://new"

    def test_get_connection(self, tmp_path: Path) -> None:
        mgr = ConnectionManager(tmp_path)
        mgr.save_connection({"type": "plex", "name": "my-plex", "base_url": "http://plex"})
        conn = mgr.get_connection("my-plex")
        assert conn is not None
        assert conn["base_url"] == "http://plex"
        assert mgr.get_connection("nonexistent") is None

    def test_get_all_config(self, tmp_path: Path) -> None:
        mgr = ConnectionManager(tmp_path)
        mgr.save_connection({"type": "plex", "name": "my-plex"})
        mgr.save_native_config("calendar", {"sources": []})
        config = mgr.get_all_config()
        assert "connections" in config
        assert "calendar" in config


class TestProviderSchemas:
    def test_all_capabilities_have_schemas(self) -> None:
        schemas = get_capability_schemas()
        assert len(schemas) >= 7
        caps = {s["capability"] for s in schemas}
        assert "media" in caps
        assert "calendar" in caps
        assert "notifications" in caps
        assert "deployment" in caps
        assert "update_discovery" in caps
        assert "auth" in caps
        assert "reasoning" in caps

    def test_media_has_four_providers(self) -> None:
        schema = get_capability_schema("media")
        assert schema is not None
        assert len(schema["providers"]) == 4
        types = {p["adapter_type"] for p in schema["providers"]}
        assert types == {"plex", "sonarr", "radarr", "lidarr"}

    def test_calendar_has_two_providers(self) -> None:
        schema = get_capability_schema("calendar")
        assert schema is not None
        assert len(schema["providers"]) == 2

    def test_notifications_has_two_providers(self) -> None:
        schema = get_capability_schema("notifications")
        assert schema is not None
        assert len(schema["providers"]) == 2

    def test_unknown_capability_returns_none(self) -> None:
        assert get_capability_schema("nonexistent") is None

    def test_provider_schema_has_config_fields(self) -> None:
        schema = get_capability_schema("media")
        plex = schema["providers"][0]
        assert len(plex["config_fields"]) >= 2
        field_keys = {f["key"] for f in plex["config_fields"]}
        assert "base_url" in field_keys
        assert "token" in field_keys

    def test_secret_fields_marked(self) -> None:
        schema = get_capability_schema("media")
        plex = schema["providers"][0]
        token_field = next(f for f in plex["config_fields"] if f["key"] == "token")
        assert token_field["secret_ref"] is True

    def test_reasoning_providers(self) -> None:
        schema = get_capability_schema("reasoning")
        assert schema is not None
        types = {p["adapter_type"] for p in schema["providers"]}
        assert "ollama" in types
        assert "openai" in types
        assert "anthropic" in types

    def test_can_test_flags_match_handlers(self) -> None:
        """Every provider with can_test=True must have a handler in
        api.py _test_adapter. Providers without handlers must have
        can_test=False."""
        # Providers with live test handlers in _test_adapter:
        live_testable = {
            "plex", "sonarr", "radarr", "lidarr",
            "ics", "ntfy", "github_release", "ollama", "oidc",
        }
        # Providers with local-only validation (not live):
        local_validators = {"compose", "systemd", "webhook"}
        # Everything else must be can_test=False
        for cap_schema in CAPABILITY_SCHEMAS.values():
            for p in cap_schema.providers:
                if p.adapter_type in live_testable:
                    assert p.can_test is True, f"{p.adapter_type} should be can_test=True"
                elif p.adapter_type in local_validators:
                    assert p.can_test is True, f"{p.adapter_type} should be can_test=True (local validation)"
                else:
                    assert p.can_test is False, (
                        f"{p.adapter_type} has can_test=True but no handler — "
                        "set can_test=False or add a handler"
                    )
