"""Framework conformance validator.

Encodes the architectural invariants from docs/NATIVE-BASELINE-AND-
ENRICHMENT.md as executable checks so they cannot silently regress:

- capabilities are core-owned; providers implement or enrich them
- every connection references a declared capability
- provider IDs are unique per capability
- provider modes are from the closed vocabulary
- required providers are explicit, justified, and rare
- no inline secret material in connection config (env indirection only)
- core compose has no provider boot dependencies
- shareable exports carry capability intent and replaceable provider
  choice, never secret-bearing provider fields

The registry already fails closed at runtime; this module catches the
architecture-level violations that runtime cannot see.
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .model import ProviderMode

SECRET_KEY_RE = re.compile(
    r"(?i)(password|passwd|secret|token|api[_-]?key|credential|private[_-]?key)$"
)
ALLOWED_REF_KEYS = {
    "token_env", "api_key_env", "secret_ref", "password_env", "env",
}
# Compose dependency keys that, when pointing at a provider service,
# would make that provider a core boot dependency.
COMPOSE_DEP_KEYS = ("depends_on", "links", "volumes_from", "network_mode")

STANDARD_CAPABILITIES = (
    "source_control", "deployment", "secrets", "calendar", "discovery",
    "settings_validation", "service_validation", "update_discovery",
    "memory", "journal", "reasoning", "notifications", "scheduler",
)


@dataclass
class Violation:
    rule: str
    detail: str

    def __str__(self) -> str:  # pragma: no cover -- display only
        return f"[{self.rule}] {self.detail}"


@dataclass
class ValidationResult:
    ok: bool = True
    violations: list[Violation] = field(default_factory=list)

    def add(self, rule: str, detail: str) -> None:
        self.ok = False
        self.violations.append(Violation(rule=rule, detail=detail))


def _scan_secretish(value, path: str, out: ValidationResult) -> None:
    """Recursively reject inline secret material and non-symbolic
    secret references in provider config."""
    if isinstance(value, dict):
        for k, v in value.items():
            key_path = f"{path}.{k}"
            if SECRET_KEY_RE.search(str(k)) and k not in ALLOWED_REF_KEYS:
                out.add(
                    "secret-rule",
                    f"connection field '{key_path}' looks like inline "
                    "secret material; use env indirection "
                    "(e.g. token_env: GITHUB_TOKEN) or secret_ref",
                )
                continue
            _scan_secretish(v, key_path, out)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _scan_secretish(v, f"{path}[{i}]", out)


def validate_connections(
    connections: dict, known_capabilities: set[str]
) -> ValidationResult:
    """Validate a parsed connections.json payload."""
    out = ValidationResult()
    conns = connections.get("connections", [])
    if not isinstance(conns, list):
        out.add("provider-registry", "connections must be a list")
        return out
    seen: dict[str, int] = {}
    for idx, conn in enumerate(conns):
        if not isinstance(conn, dict):
            out.add("provider-registry", f"connection #{idx} is not an object")
            continue
        ptype = conn.get("type")
        name = conn.get("name")
        capability = conn.get("capability")
        label = name or f"#{idx}"
        if not all([ptype, name, capability]):
            out.add(
                "provider-registry",
                f"connection '{label}' missing type/name/capability",
            )
            continue
        if capability not in known_capabilities:
            out.add(
                "capability-ownership",
                f"provider '{name}' claims capability '{capability}' "
                "which is not a declared capability",
            )
        seen[name] = seen.get(name, 0) + 1
        mode = conn.get("mode", ProviderMode.ENRICHMENT.value)
        if mode not in {m.value for m in ProviderMode}:
            out.add(
                "provider-mode",
                f"provider '{name}' has unsupported mode '{mode}'",
            )
        required = conn.get("required", False)
        if required and not conn.get("required_reason"):
            out.add(
                "optional-default",
                f"provider '{name}' is marked required without a "
                "required_reason; required is an explicit exception",
            )
        _scan_secretish(conn, f"connections[{label}]", out)
    for name, count in seen.items():
        if count > 1:
            out.add(
                "provider-registry",
                f"duplicate provider id '{name}' ({count} connections)",
            )
    return out


def validate_compose_file(path: Path, provider_service_names: set[str]) -> ValidationResult:
    """Reject core compose boot dependencies on provider services
    (framework Rule 6: providers cannot silently become required)."""
    out = ValidationResult()
    if not path.exists():
        return out
    compose = yaml.safe_load(path.read_text()) or {}
    for svc_name, svc in compose.get("services", {}).items():
        if svc_name in provider_service_names:
            # Provider-side services may depend on each other or the
            # core; the constraint under test is the core's freedom.
            continue
        for dep_key in COMPOSE_DEP_KEYS:
            deps = svc.get(dep_key)
            if deps is None:
                continue
            targets = list(deps.keys()) if isinstance(deps, dict) else list(deps)
            for target in targets:
                if target in provider_service_names:
                    out.add(
                        "compose-additive",
                        f"core service '{svc_name}' has {dep_key} on "
                        f"provider service '{target}'; optional providers "
                        "must be additive, not boot dependencies",
                    )
    return out


def validate_settings_export(export: dict) -> ValidationResult:
    """The shareable blueprint must express capability intent plus
    replaceable provider choice (framework export rule)."""
    out = ValidationResult()
    for cap in export.get("capabilities", []):
        for p in cap.get("providers", []):
            for forbidden in ("config", "requires_secrets"):
                if forbidden in p:
                    out.add(
                        "export-portability",
                        f"settings-export provider entry for "
                        f"'{cap.get('key')}' includes forbidden field "
                        f"'{forbidden}'",
                    )
    return out


PACK_REQUIRED_TOP_KEYS = (
    "schema",
    "id",
)


def validate_participant_packs(
    participants_dir: Path,
    project_root: Path | None = None,
) -> ValidationResult:
    """Validate participant packs under ``participants_dir``.

    This is the canonical Play-Nice participant-pack gate for Project
    Worlds. It is intentionally project-neutral (is in the
    ``personal_world`` package, not in any harness config) so it can be
    driven from any agent harness, CI, or a human running pytest.

    Scope: only files named ``participant.yaml`` are treated as the
    participant record itself. Sidecar files
    (``capabilities.yaml``, ``help-routing.yaml``, ``attestation.yaml``,
    ``interaction.md``, ``ONBOARDING.md``) live alongside the
    participant record and are referenced from it via
    ``capabilities_file``, ``interaction_file``, etc.; they are NOT
    participant records and are out of scope for this validator.
    Concretely: a participant pack is one directory containing one
    ``participant.yaml`` plus optional sidecars.

    Checks (deterministic, fail-closed):

    - every ``participant.yaml`` under ``participants_dir`` parses with
      ``yaml.safe_load``; malformed YAML is a hard violation
      (``pack-parse``).
    - every pack declares at minimum the ``schema`` and ``id`` keys
      (``pack-shape``); missing keys fail closed.
    - no two packs may share the same ``id`` (``pack-id-collision``).
    - the ``schema`` value, if present, must be a string starting with
      ``play-nice/`` (``pack-schema-namespace``). This is a coarse
      shape check; per-schema structural validation lives upstream in
      ``play-nice-contracts`` and is not duplicated here.

    The function does NOT validate cross-pack contracts, run contract
    attestation, or interpret semantics beyond the schema string. That
    is the role of the canonical ``play-nice-contracts`` library and
    belongs upstream, not in this project.

    The function is pure and side-effect free; it does not write any
    file under ``participants_dir``.
    """
    out = ValidationResult()
    root = Path(participants_dir)
    if not root.exists():
        out.add("pack-discovery", f"participants directory '{root}' does not exist")
        return out
    if not root.is_dir():
        out.add("pack-discovery", f"participants path '{root}' is not a directory")
        return out

    yaml_files = sorted(
        p for p in root.rglob("participant.yaml") if p.is_file()
    )
    if not yaml_files:
        out.add(
            "pack-discovery",
            f"no participant.yaml files found under '{root}' "
            f"(a participant pack is one directory containing "
            f"participant.yaml plus optional sidecars)",
        )
        return out

    seen_ids: dict[str, Path] = {}
    for path in yaml_files:
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            out.add("pack-read", f"could not read '{path}': {exc}")
            continue
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            msg = str(exc).splitlines()[0] if exc else "unknown"
            out.add("pack-parse", f"'{path}' is not valid YAML: {msg}")
            continue
        if not isinstance(data, dict):
            out.add(
                "pack-shape",
                f"'{path}' top-level YAML is not a mapping "
                f"(got {type(data).__name__})",
            )
            continue
        for required_key in PACK_REQUIRED_TOP_KEYS:
            if required_key not in data:
                out.add(
                    "pack-shape",
                    f"'{path}' is missing required top-level key "
                    f"'{required_key}'",
                )
        schema_val = data.get("schema")
        if schema_val is not None:
            if not isinstance(schema_val, str) or not schema_val.startswith("play-nice/"):
                out.add(
                    "pack-schema-namespace",
                    f"'{path}' schema must be a string starting with "
                    f"'play-nice/' (got {schema_val!r})",
                )
        pack_id = data.get("id")
        if isinstance(pack_id, str):
            if pack_id in seen_ids:
                out.add(
                    "pack-id-collision",
                    f"participant id '{pack_id}' is declared in both "
                    f"'{seen_ids[pack_id]}' and '{path}'",
                )
            else:
                seen_ids[pack_id] = path
    return out
