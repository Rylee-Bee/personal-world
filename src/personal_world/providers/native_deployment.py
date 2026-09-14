"""Native Deployment provider: provider-neutral deployment domain.

Worlds owns: target, current state, desired version/state, operation,
result, rollback availability, evidence, provenance.
Adapters perform actual deployment. All mutations go through
propose → approve → step-up → execute → re-observe → evidence.
"""

import json
import subprocess
import os
from ..envelope import Result, fail, ok
from ..status import Status
from .registry import StatusContract


class DockerComposeAdapter:
    """Deploy via docker compose."""

    def __init__(self, compose_path=None, project_name=None):
        self.compose_path = compose_path
        self.project_name = project_name

    def status(self) -> dict:
        """Get current deployment status."""
        try:
            cmd = ["docker", "compose", "ps", "--format", "json"]
            if self.compose_path:
                cmd.extend(["-f", self.compose_path])
            if self.project_name:
                cmd.extend(["-p", self.project_name])
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if result.returncode == 0:
                containers = []
                for line in result.stdout.strip().split("\n"):
                    if line.strip():
                        try:
                            containers.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass
                return {"status": "running", "containers": len(containers), "provider": "compose"}
            return {"status": "unknown", "error": result.stderr[:200], "provider": "compose"}
        except Exception as e:
            return {"status": "unavailable", "error": str(e), "provider": "compose"}

    def deploy(self) -> bool:
        """Pull and recreate. Returns success."""
        try:
            cmd = ["docker", "compose", "up", "-d", "--pull", "always"]
            if self.compose_path:
                cmd.extend(["-f", self.compose_path])
            if self.project_name:
                cmd.extend(["-p", self.project_name])
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            return result.returncode == 0
        except Exception:
            return False


class SystemdAdapter:
    """Deploy via systemd service."""

    def __init__(self, service_name):
        self.service_name = service_name

    def status(self) -> dict:
        try:
            result = subprocess.run(
                ["systemctl", "is-active", self.service_name],
                capture_output=True, text=True, timeout=5
            )
            return {"status": result.stdout.strip(), "provider": "systemd", "service": self.service_name}
        except Exception as e:
            return {"status": "unavailable", "error": str(e), "provider": "systemd"}

    def deploy(self) -> bool:
        try:
            result = subprocess.run(
                ["sudo", "systemctl", "restart", self.service_name],
                capture_output=True, text=True, timeout=30
            )
            return result.returncode == 0
        except Exception:
            return False


class NativeDeploymentProvider(StatusContract):
    """Native deployment capability with compose/systemd adapters."""

    def __init__(self, config=None):
        self._adapters = []
        self._config = config or {}
        self._load_adapters()

    def _load_adapters(self):
        """Load configured deployment targets."""
        targets = self._config.get("targets", [])
        for t in targets:
            ttype = t.get("type")
            if ttype == "compose":
                self._adapters.append(DockerComposeAdapter(
                    t.get("compose_path"), t.get("project_name")
                ))
            elif ttype == "systemd" and t.get("service"):
                self._adapters.append(SystemdAdapter(t["service"]))

    def observe(self) -> Result:
        """Report deployment capability status."""
        if not self._adapters:
            return ok(Status.NOT_CONFIGURED.value, data={
                "targets": [],
                "message": "no deployment targets configured",
                "provider": "native_deployment",
            })
        statuses = [a.status() for a in self._adapters]
        return ok(Status.HEALTHY.value, data={
            "targets": statuses,
            "provider": "native_deployment",
        })

    def status(self) -> Result:
        """Get deployment status for all targets."""
        try:
            statuses = [a.status() for a in self._adapters]
            return ok(Status.HEALTHY.value, data={"targets": statuses})
        except Exception as e:
            return fail(Status.UNAVAILABLE.value, warnings=[f"deployment: {e}"])

    def health(self) -> bool:
        return True
