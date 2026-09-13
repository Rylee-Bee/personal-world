"""Native Lab provider: generic lab capabilities for Project Worlds.

This is the native Lab product that ships with Project Worlds.
It provides generic capabilities for:
- Service inventory and discovery
- Health monitoring
- Settings inspection and reconciliation
- Resource monitoring
- Action execution (with approval)

Users configure their own environment through site profiles.
The homelab CLI is one possible provider, not the only one.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from ..envelope import Result, fail, ok
from ..status import Status
from .registry import Contract, StatusContract


class NativeLabInventory(StatusContract):
    """Native service inventory: discovers and tracks services."""

    def __init__(self, config_path: Path | None = None):
        self.config_path = config_path or Path("~/.config/personal-world/lab.json").expanduser()
        self._services: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        """Load service inventory from config."""
        if self.config_path.exists():
            try:
                data = json.loads(self.config_path.read_text())
                self._services = data.get("services", {})
            except (json.JSONDecodeError, OSError):
                self._services = {}

    def observe(self) -> Result:
        """Return current service inventory."""
        services = []
        for name, config in self._services.items():
            services.append({
                "name": name,
                "type": config.get("type", "unknown"),
                "status": config.get("status", "unknown"),
                "url": config.get("url"),
                "health_check": config.get("health_check"),
                "last_seen": config.get("last_seen"),
            })

        return ok(
            Status.HEALTHY.value,
            data={
                "services": services,
                "count": len(services),
                "inventory_path": str(self.config_path),
            },
        )

    def add_service(self, name: str, config: dict[str, Any]) -> None:
        """Add a service to the inventory."""
        self._services[name] = config
        self._save()

    def remove_service(self, name: str) -> None:
        """Remove a service from the inventory."""
        self._services.pop(name, None)
        self._save()

    def _save(self) -> None:
        """Save inventory to config."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "schema_version": 1,
            "services": self._services,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self.config_path.write_text(json.dumps(data, indent=2))


class NativeLabHealth(StatusContract):
    """Native health monitoring: checks service health."""

    def __init__(self, inventory: NativeLabInventory):
        self.inventory = inventory

    def observe(self) -> Result:
        """Check health of all services in inventory."""
        services = []
        healthy = 0
        unhealthy = 0
        unknown = 0

        for name, config in self.inventory._services.items():
            status = self._check_health(name, config)
            services.append({
                "name": name,
                "status": status,
                "type": config.get("type", "unknown"),
            })
            if status == "healthy":
                healthy += 1
            elif status == "unhealthy":
                unhealthy += 1
            else:
                unknown += 1

        overall = Status.HEALTHY.value if unhealthy == 0 else Status.NEEDS_ATTENTION.value
        return ok(
            overall,
            data={
                "services": services,
                "summary": {
                    "total": len(services),
                    "healthy": healthy,
                    "unhealthy": unhealthy,
                    "unknown": unknown,
                },
            },
        )

    def _check_health(self, name: str, config: dict[str, Any]) -> str:
        """Check health of a single service."""
        # For now, return unknown - real health checks would be implemented
        # based on the service type and configuration
        return config.get("status", "unknown")


class NativeLabSettings(StatusContract):
    """Native settings inspection: reads desired state."""

    def __init__(self, desired_path: Path | None = None):
        self.desired_path = desired_path or Path("~/.config/personal-world/lab/desired").expanduser()
        self._desired: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        """Load desired state from config."""
        if self.desired_path.exists():
            for f in self.desired_path.glob("*.yml"):
                try:
                    import yaml
                    self._desired[f.stem] = yaml.safe_load(f.read_text())
                except Exception:
                    pass

    def observe(self) -> Result:
        """Return current desired state."""
        services = []
        for name, config in self._desired.items():
            services.append({
                "name": name,
                "settings": config,
                "source": str(self.desired_path / f"{name}.yml"),
            })

        return ok(
            Status.HEALTHY.value,
            data={
                "services": services,
                "count": len(services),
                "desired_path": str(self.desired_path),
            },
        )

    def diff(self, service: str, live: dict[str, Any]) -> Result:
        """Compare desired vs live state."""
        desired = self._desired.get(service, {})
        drift = []

        for key, want in desired.items():
            have = live.get(key)
            if have != want:
                drift.append({
                    "key": key,
                    "desired": want,
                    "actual": have,
                    "action": "update" if have is not None else "create",
                })

        return ok(
            Status.HEALTHY.value if not drift else Status.NEEDS_ATTENTION.value,
            data={
                "service": service,
                "drift": drift,
                "has_drift": len(drift) > 0,
            },
        )


class NativeLabResources(StatusContract):
    """Native resource monitoring: tracks system resources."""

    def observe(self) -> Result:
        """Return current resource usage."""
        import os

        # Basic resource info - would be extended with real monitoring
        resources = {
            "cpu_count": os.cpu_count(),
            "load_average": list(os.getloadavg()) if hasattr(os, 'getloadavg') else None,
            "memory": self._get_memory(),
            "disk": self._get_disk(),
        }

        return ok(
            Status.HEALTHY.value,
            data=resources,
        )

    def _get_memory(self) -> dict[str, Any]:
        """Get memory usage."""
        try:
            with open('/proc/meminfo') as f:
                lines = f.readlines()
            mem = {}
            for line in lines:
                if ':' in line:
                    key, value = line.split(':', 1)
                    mem[key.strip()] = int(value.strip().split()[0]) * 1024  # Convert kB to bytes
            return {
                "total": mem.get("MemTotal", 0),
                "available": mem.get("MemAvailable", 0),
                "used": mem.get("MemTotal", 0) - mem.get("MemAvailable", 0),
            }
        except Exception:
            return {"total": 0, "available": 0, "used": 0}

    def _get_disk(self) -> dict[str, Any]:
        """Get disk usage."""
        import shutil
        try:
            usage = shutil.disk_usage("/")
            return {
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
            }
        except Exception:
            return {"total": 0, "used": 0, "free": 0}
