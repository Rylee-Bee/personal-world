"""Outbound confinement seam (owned by L-authority; contract: docs/rebuild/CONTRACTS.md).

L-foundation's runner calls ``confined_request`` for EVERY outbound request.
This stub only fixes the signature; L-authority replaces the body with the
SSRF/redirect/size/time guard. Until then it refuses to send anything.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

ErrorClass = Literal[
    "timeout",
    "connection",
    "http_4xx",
    "http_5xx",
    "malformed",
    "redirect_refused",
    "too_large",
    "confinement_denied",
    "auth_failed",
]


@dataclass(frozen=True)
class RawResponse:
    status_code: int
    headers: dict[str, str] = field(default_factory=dict)
    body: bytes = b""
    duration_ms: int = 0


@dataclass(frozen=True)
class ConfinementError:
    error_class: ErrorClass
    note: str = ""
    status_code: int | None = None
    duration_ms: int | None = None


def confined_request(
    provider: Any, request: Any, *, effect: Literal["read", "write"]
) -> RawResponse | ConfinementError:
    """Send one request. Never retries, never follows redirects."""
    return ConfinementError("confinement_denied", "confinement module not installed")
