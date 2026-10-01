"""Strict secret-reference resolution for the front door: ``env:NAME`` and ``vault:NAME`` only.

No bare-name guessing and no ``${NAME}`` form (the old implicit rules are gone). A value is
returned only to the caller that must send it; it is never logged here.
"""

from __future__ import annotations

import os
import re
from typing import Any

_REF = re.compile(r"^(env|vault):([A-Za-z_][A-Za-z0-9_.-]*)$")
_vault: Any = None


def set_vault(vault: Any) -> None:
    """Register the process vault (an object with ``is_unlocked`` and ``get(name)``)."""
    global _vault
    _vault = vault


def resolve_secret_ref(ref: str | None) -> str | None:
    """Return the secret value, or None when the reference is malformed, unset or locked."""
    if not isinstance(ref, str):
        return None
    m = _REF.match(ref)
    if not m:
        return None
    kind, name = m.groups()
    if kind == "env":
        return os.environ.get(name) or None
    if _vault is None or not getattr(_vault, "is_unlocked", False):
        return None
    try:
        return _vault.get(name) or None
    except Exception:
        return None
