"""Connection manager: CRUD for private runtime configuration.

Writes to connections.local.json (never the tracked connections.json).
Hot-reloads the provider registry after saves.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class ConnectionManager:
    """Manages private connection configuration."""

    def __init__(self, config_dir: Path):
        self._config_dir = config_dir
        self._local_path = config_dir / "connections.local.json"

    def _read_local(self) -> dict[str, Any]:
        if self._local_path.exists():
            try:
                return json.loads(self._local_path.read_text())
            except (json.JSONDecodeError, OSError):
                pass
        return {}

    def _write_local(self, data: dict[str, Any]) -> None:
        self._local_path.parent.mkdir(parents=True, exist_ok=True)
        self._local_path.write_text(json.dumps(data, indent=2))

    def _read_all(self) -> dict[str, Any]:
        """Read merged config (tracked + local)."""
        result: dict[str, Any] = {}
        for name in ("connections.json", "connections.local.json"):
            path = self._config_dir / name
            if path.exists():
                try:
                    data = json.loads(path.read_text())
                    # Merge connections arrays
                    if "connections" in data:
                        existing = result.get("connections", [])
                        new = [c for c in data["connections"] if isinstance(c, dict)]
                        result["connections"] = existing + new
                    # Other keys: local overrides tracked
                    for k, v in data.items():
                        if k not in ("connections", "$schema"):
                            result[k] = v
                except (json.JSONDecodeError, OSError):
                    pass
        return result

    def get_connections(self) -> list[dict[str, Any]]:
        """Get all connections (merged tracked + local)."""
        data = self._read_all()
        return data.get("connections", [])

    def get_native_config(self, key: str) -> dict[str, Any]:
        """Get native provider config (e.g., 'calendar', 'notifications')."""
        data = self._read_all()
        return data.get(key, {})

    def save_native_config(self, key: str, config: dict[str, Any]) -> None:
        """Save native provider config to connections.local.json."""
        local = self._read_local()
        local[key] = config
        self._write_local(local)

    def save_connection(self, conn: dict[str, Any]) -> None:
        """Save or update a connection entry in connections.local.json.

        If a connection with the same name exists, it's replaced.
        Otherwise it's appended.
        """
        local = self._read_local()
        connections = local.get("connections", [])
        name = conn.get("name", "")
        # Replace existing or append
        connections = [c for c in connections if c.get("name") != name]
        connections.append(conn)
        local["connections"] = connections
        self._write_local(local)

    def delete_connection(self, name: str) -> bool:
        """Delete a connection by name from connections.local.json."""
        local = self._read_local()
        connections = local.get("connections", [])
        before = len(connections)
        connections = [c for c in connections if c.get("name") != name]
        if len(connections) == before:
            return False
        local["connections"] = connections
        self._write_local(local)
        return True

    def get_connection(self, name: str) -> dict[str, Any] | None:
        """Get a single connection by name."""
        for c in self.get_connections():
            if c.get("name") == name:
                return c
        return None

    def get_all_config(self) -> dict[str, Any]:
        """Get the full merged config for inspection."""
        return self._read_all()
