"""C1 config models (docs/rebuild/CONTRACTS.md). Every file carries schema_version: 1."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Annotated, Any, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

ID_RE = r"^[a-z0-9][a-z0-9-]{0,62}$"
REQUEST_ID_RE = r"^[a-z0-9][a-z0-9-]{0,62}\.[a-z0-9][a-z0-9-]{0,62}$"
SECRET_REF_RE = re.compile(r"^(env|vault|file):[A-Za-z_][A-Za-z0-9_.-]*$")
# Request headers are an ALLOW-list (C1). Credentials come only from the provider's auth block.
ALLOWED_HEADERS = {
    "accept", "accept-language", "content-type", "user-agent", "if-none-match", "if-modified-since",
    "idempotency-key",  # required by C3 for actions that declare idempotency
}

Id = Annotated[str, StringConstraints(pattern=ID_RE)]
RequestId = Annotated[str, StringConstraints(pattern=REQUEST_ID_RE)]


def _check_path(path: str | None) -> str | None:
    """Reject a path outside the JSONPath subset at save time, not at first render."""
    if path is not None:
        from .mapping import MappingError, parse_path

        try:
            parse_path(path)
        except MappingError as exc:
            raise ValueError(str(exc)) from None
    return path


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1


# Header names a credential may NOT be placed in: framing, hop-by-hop, proxy and forwarding headers.
FORBIDDEN_AUTH_HEADERS = {
    "host", "cookie", "set-cookie", "transfer-encoding", "content-length", "content-type", "connection", "upgrade",
    "te", "trailer", "keep-alive", "expect", "authorization", "proxy-authorization", "proxy-authenticate",
    "proxy-connection", "forwarded", "via", "x-real-ip", "origin", "referer", "accept", "user-agent", "range",
    "idempotency-key", "if-match", "if-none-match", "if-modified-since", "content-encoding", "accept-encoding",
}
_TOKEN_HEADER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{0,63}$")


def check_auth_header_name(name: str) -> str:
    """A credential header must be a plain token name outside the framing/forwarding set."""
    low = name.lower()
    if not _TOKEN_HEADER.match(name):
        raise ValueError("header_name must be letters, digits and hyphens only")
    if low in FORBIDDEN_AUTH_HEADERS or low.startswith(("x-forwarded-", "proxy-", "sec-")):
        raise ValueError(f"header_name {name!r} cannot carry a credential (use auth.type bearer for Authorization)")
    return name


class Auth(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["none", "bearer", "header", "basic"] = "none"
    header_name: str | None = None
    secret_ref: str | None = None

    @field_validator("header_name")
    @classmethod
    def _header(cls, v: str | None) -> str | None:
        return check_auth_header_name(v) if v is not None else v

    @model_validator(mode="after")
    def _check(self) -> "Auth":
        if self.type == "none":
            if self.secret_ref:
                raise ValueError("auth.type none must not have secret_ref")
            return self
        if not self.secret_ref or not SECRET_REF_RE.match(self.secret_ref):
            raise ValueError("secret_ref must be env:NAME, vault:NAME or file:NAME")
        if self.type == "header" and not self.header_name:
            raise ValueError("auth.type header needs header_name")
        return self


class Network(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lan: bool = False


class Provider(_Strict):
    id: Id
    name: str = Field(min_length=1, max_length=120)
    kind: Literal["http", "room0", "reference"]
    base_url: str
    path_prefix: str = ""
    auth: Auth = Field(default_factory=Auth)
    network: Network = Field(default_factory=Network)
    # Who approves operations on this provider. None: room0 providers are governed by Project Home
    # (fail closed), everything else by Worlds.
    governance: Literal["worlds", "project_home"] | None = None
    tls_verify: bool = True
    timeout_s: float = Field(default=5, gt=0, le=15)
    max_bytes: int = Field(default=2 * 1024 * 1024, gt=0, le=8 * 1024 * 1024)

    def governed_by_project_home(self) -> bool:
        return self.governance == "project_home" or (self.governance is None and self.kind == "room0")

    @field_validator("base_url")
    @classmethod
    def _base(cls, v: str) -> str:
        if not re.match(r"^https?://[^/\s@]+(/[^\s]*)?$", v):
            raise ValueError("base_url must be http(s)://host[:port][/path] without userinfo")
        parts = urlsplit(v)
        if parts.username is not None or parts.password is not None or parts.query or parts.fragment:
            raise ValueError("base_url must not carry userinfo, query or fragment")
        return v

    @field_validator("path_prefix")
    @classmethod
    def _prefix(cls, v: str) -> str:
        if v and (not v.startswith("/") or ".." in v.split("/") or "://" in v):
            raise ValueError("path_prefix must be an absolute path without ..")
        return v


class Assertion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: int | None = None
    path: str | None = None
    exists: bool | None = None
    is_list: bool | None = None
    equals: Any = None

    @model_validator(mode="after")
    def _check(self) -> "Assertion":
        if self.status is None and self.path is None:
            raise ValueError("assertion needs status or path")
        _check_path(self.path)
        return self


class Request(_Strict):
    id: RequestId
    provider: Id
    method: Literal["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] = "GET"
    path: str
    query: dict[str, str] = Field(default_factory=dict)
    headers: dict[str, str] = Field(default_factory=dict)
    body: Any = None
    effect: Literal["auto", "read", "write"] = "auto"
    known_safe: bool = False
    ttl_s: int = Field(default=60, ge=0, le=86400)
    timeout_s: float | None = Field(default=None, gt=0, le=15)
    assertions: list[Assertion] = Field(default_factory=list)

    @field_validator("path")
    @classmethod
    def _path(cls, v: str) -> str:
        if not v.startswith("/") or "://" in v or v.startswith("//") or "\\" in v:
            raise ValueError("path must be relative to the provider (start with /, no scheme or host)")
        if ".." in v.split("?")[0].split("/") or "%2e" in v.lower() or "%2f" in v.lower():
            raise ValueError("path must not contain .. or encoded separators")
        from .templates import has_template

        if has_template(v):
            raise ValueError("templates like {today} are only allowed in query values")
        return v

    @field_validator("query")
    @classmethod
    def _query(cls, v: dict[str, str]) -> dict[str, str]:
        from .templates import check_query_value

        for value in v.values():
            check_query_value(value)
        return v

    @field_validator("headers")
    @classmethod
    def _headers(cls, v: dict[str, str]) -> dict[str, str]:
        bad = [h for h in v if h.lower() not in ALLOWED_HEADERS]
        if bad:
            raise ValueError(f"headers not allowed (allow-list: {sorted(ALLOWED_HEADERS)}): {bad}")
        from .templates import has_template

        for name, value in v.items():
            if any(c in f"{name}{value}" for c in ("\r", "\n", "\x00")):
                raise ValueError("header contains a control character")
            if has_template(value):
                raise ValueError("templates like {today} are only allowed in query values")
        return v

    @model_validator(mode="after")
    def _prefix(self) -> "Request":
        if not self.id.startswith(self.provider + "."):
            raise ValueError("request id must be <provider>.<name>")
        return self

    def resolved_effect(self) -> Literal["read", "write"]:
        base = "read" if self.method in ("GET", "HEAD") else "write"
        if self.effect == "write":
            return "write"
        if self.effect == "read":
            if base == "write" and not self.known_safe:
                return "write"  # never lower write to read without known_safe
            return "read"
        return base


class Field_(BaseModel):
    model_config = ConfigDict(extra="forbid")
    path: str
    label: str
    format: Literal["number", "percent", "bytes", "duration", "relative_time", "text", "count"] = "text"
    unit: str | None = None

    @field_validator("path")
    @classmethod
    def _jsonpath(cls, v: str) -> str:
        return _check_path(v) or v


class Meaning(BaseModel):
    model_config = ConfigDict(extra="forbid")
    concept: str
    short: str
    full: str = ""


class Above(BaseModel):
    """A threshold (C1.3): when the first extracted value is a number above ``value``, the card is in ``state``."""

    model_config = ConfigDict(extra="forbid")
    value: float
    state: Literal["needs_attention", "degraded"]

    @field_validator("value")
    @classmethod
    def _finite(cls, v: float) -> float:
        import math

        if isinstance(v, bool) or not math.isfinite(v):
            raise ValueError("above.value must be a finite number")
        return v


class StatusMap(BaseModel):
    model_config = ConfigDict(extra="forbid")
    path: str

    @field_validator("path")
    @classmethod
    def _jsonpath(cls, v: str) -> str:
        return _check_path(v) or v

    healthy: list[Any] = Field(default_factory=list)
    needs_attention: list[Any] = Field(default_factory=list)
    # first: the first extracted value decides. all / any: every extracted value counts (C1.3).
    mode: Literal["first", "all", "any"] = "first"
    # What an EXISTING but empty list means (e.g. a health list with no problems). A missing path is always unknown.
    empty: Literal["unknown", "healthy"] = "unknown"
    # A numeric threshold, checked before the healthy / needs_attention lists.
    above: Above | None = None


_KEY_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def _check_ref(v: Any, *, allow_number: bool) -> Any:
    """A meter source: a number, a JSONPath ($...), or the key of one of the card's fields."""
    if v is None:
        return v
    if isinstance(v, bool):
        raise ValueError("meter source must be a number, a $ path or a field key")
    if isinstance(v, (int, float)):
        if not allow_number:
            raise ValueError("this meter source cannot be a literal number")
        return v
    if isinstance(v, str):
        if v.startswith("$"):
            _check_path(v)
            return v
        if _KEY_RE.match(v):
            return v
    raise ValueError("meter source must be a number, a $ path or a field key")


class Meter(BaseModel):
    """Which card data feeds the meter (C1). The envelope carries the resolved numbers (C2)."""

    model_config = ConfigDict(extra="forbid")
    type: Literal["segments", "bars", "progress", "marks", "dots", "day", "shelf"]
    value: Any = None      # progress: field key or path
    max: Any = None        # progress: number, field key or path
    count: Any = None      # segments: number, field key or path
    filled: Any = None     # segments: number, field key or path
    items: str | None = None  # bars/marks/dots/day/shelf: path to a list

    @field_validator("value")
    @classmethod
    def _v(cls, v: Any) -> Any:
        return _check_ref(v, allow_number=False)

    @field_validator("max", "count", "filled")
    @classmethod
    def _n(cls, v: Any) -> Any:
        return _check_ref(v, allow_number=True)

    @field_validator("items")
    @classmethod
    def _i(cls, v: str | None) -> str | None:
        if v is not None and not v.startswith("$"):
            raise ValueError("meter items must be a $ path to a list")
        return _check_path(v)

    @model_validator(mode="after")
    def _shape(self) -> "Meter":
        if self.type == "progress" and self.value is None:
            raise ValueError("a progress meter needs value")
        if self.type == "segments" and (self.count is None or self.filled is None):
            raise ValueError("a segments meter needs count and filled")
        return self


class Card(_Strict):
    id: Id
    title: str = Field(min_length=1, max_length=120)
    icon: str = "circle"
    group: Literal["life", "machine"] = "machine"
    request: RequestId | None = None
    requests: list[RequestId] = Field(default_factory=list)
    view: Literal["stat", "list", "table", "status", "meter", "link", "markdown"] = "stat"
    meaning: Meaning
    fields: list[Field_] = Field(default_factory=list)
    meter: Meter | None = None
    status: StatusMap | None = None

    @model_validator(mode="after")
    def _one_source(self) -> "Card":
        if bool(self.request) == bool(self.requests):
            raise ValueError("card needs exactly one of request or requests")
        return self

    def request_ids(self) -> list[str]:
        return [self.request] if self.request else list(self.requests)


class BoardItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    card: Id
    size: Literal["S", "M", "L"] = "M"
    hidden: bool = False


class Board(_Strict):
    id: Id
    title: str = Field(min_length=1, max_length=120)
    home: bool = False
    items: list[BoardItem] = Field(default_factory=list)


class Action(_Strict):
    id: Id
    request: RequestId
    name: str = Field(min_length=1, max_length=120)
    access: Literal["read", "write"] = "write"
    approval: Literal["never", "always"] = "always"
    scope: str = ""
    idempotency: Literal["required", "optional", "none"] = "optional"
    exposed: bool = False
    # Only an owner (config writes are owner-only) can waive approval for a request that WRITES.
    owner_waives_approval: bool = False

    @model_validator(mode="after")
    def _waiver_needs_never(self) -> "Action":
        if self.owner_waives_approval and self.approval != "never":
            raise ValueError("owner_waives_approval only makes sense with approval: never")
        return self


def canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def action_version(action: Action, request: Request, provider: Provider) -> str:
    """sha256 of the canonicalized resolved action + request + provider destination.

    Computed, never written. Covers destination and credential ref (not the secret value).
    """
    payload = {
        "action": action.model_dump(mode="json"),
        "request": request.model_dump(mode="json"),
        "provider": {
            "id": provider.id,
            "kind": provider.kind,
            "base_url": provider.base_url,
            "path_prefix": provider.path_prefix,
            "auth": provider.auth.model_dump(mode="json"),
            "network": provider.network.model_dump(mode="json"),
            "tls_verify": provider.tls_verify,
        },
    }
    return hashlib.sha256(canonical_json(payload).encode()).hexdigest()
