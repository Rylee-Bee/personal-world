"""Recipe templates: sanitized C1 config for a homelab service, installed into the owner's config.

A recipe is a directory under ``config/recipes/<name>/``::

    recipe.yaml            name, title, summary, status (ready | planned), note, env (secret NAMES the provider uses)
    provider.yaml          C1 provider with a placeholder base_url (``*.lan.example``) and an ``env:NAME`` secret_ref
    requests/<name>.yaml   C1 requests (read-only; the one exception is a request an action points at)
    cards/<id>.yaml        C1 cards
    actions/<id>.yaml      C1 actions (approval: always, exposed: false)

Real hostnames, domains and keys never live in a recipe. ``install`` writes the objects through the same
:class:`ConfigStore` the API uses, so they get the same validation, references and etags.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import yaml
from pydantic import BaseModel, ConfigDict, Field

from .config_store import ConfigStore
from .models import Action, Card, Id, Provider, Request

__all__ = ["Recipe", "RecipeError", "RecipeInfo", "install", "list_recipes", "load_recipe", "recipes_dir"]

PLACEHOLDER_SUFFIXES = (".example", ".example.com", ".example.org", ".example.net")


class RecipeError(Exception):
    """A recipe cannot be loaded or installed; the message is safe to show."""


class RecipeInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: int = 1
    name: Id
    title: str = Field(min_length=1, max_length=120)
    summary: str = Field(min_length=1, max_length=400)
    #: ready = installable; planned = listed, cannot be installed yet (``note`` says why).
    status: str = Field(default="ready", pattern="^(ready|planned)$")
    note: str = ""
    #: The secret NAMES the provider reads (never values).
    env: list[str] = Field(default_factory=list)


@dataclass
class Recipe:
    info: RecipeInfo
    provider: Provider | None = None
    requests: list[Request] = field(default_factory=list)
    cards: list[Card] = field(default_factory=list)
    actions: list[Action] = field(default_factory=list)


def recipes_dir() -> Path:
    """``$PW_RECIPES_DIR``, else ``config/recipes`` next to the source tree."""
    env = os.environ.get("PW_RECIPES_DIR")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "config" / "recipes").is_dir():
            return parent / "config" / "recipes"
    return Path("config/recipes")


def _read(path: Path) -> dict[str, Any]:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise RecipeError(f"{path.name}: unreadable ({type(exc).__name__})") from None
    if not isinstance(data, dict):
        raise RecipeError(f"{path.name}: top level must be a mapping")
    return data


def _model(model: type[BaseModel], path: Path) -> Any:
    try:
        return model.model_validate(_read(path))
    except RecipeError:
        raise
    except Exception as exc:  # pydantic ValidationError: keep it short, never echo values
        raise RecipeError(f"{path.parent.name}/{path.name}: invalid ({str(exc).splitlines()[0][:160]})") from None


def list_recipes(root: Path | None = None) -> list[RecipeInfo]:
    base = root or recipes_dir()
    out: list[RecipeInfo] = []
    if not base.is_dir():
        return out
    for d in sorted(p for p in base.iterdir() if p.is_dir()):
        if (d / "recipe.yaml").is_file():
            out.append(_model(RecipeInfo, d / "recipe.yaml"))
    return out


def load_recipe(name: str, root: Path | None = None) -> Recipe:
    base = root or recipes_dir()
    d = base / name
    if not (d / "recipe.yaml").is_file() or "/" in name or ".." in name:
        raise RecipeError(f"no recipe named {name!r}")
    info = _model(RecipeInfo, d / "recipe.yaml")
    if info.name != name:
        raise RecipeError(f"recipe.yaml name {info.name!r} does not match its directory {name!r}")
    recipe = Recipe(info=info)
    if (d / "provider.yaml").is_file():
        recipe.provider = _model(Provider, d / "provider.yaml")
    for sub, model, bucket in (("requests", Request, recipe.requests), ("cards", Card, recipe.cards), ("actions", Action, recipe.actions)):
        folder = d / sub
        if folder.is_dir():
            for f in sorted(folder.glob("*.yaml")):
                bucket.append(_model(model, f))
    return recipe


def _is_placeholder(base_url: str) -> bool:
    host = (urlsplit(base_url).hostname or "").lower()
    return host.endswith(PLACEHOLDER_SUFFIXES)


def install(
    store: ConfigStore,
    recipe: Recipe,
    *,
    base_url: str | None = None,
    secret_ref: str | None = None,
    overwrite: bool = False,
) -> list[str]:
    """Write the recipe into ``store``. Returns the ids written. Existing objects are kept unless ``overwrite``.

    The provider's placeholder ``base_url`` is never installed: the owner supplies the real one here, at install
    time, and it goes only into their own config directory.
    """
    if recipe.info.status != "ready" or recipe.provider is None:
        raise RecipeError(f"{recipe.info.name} cannot be installed yet: {recipe.info.note or 'not ready'}")
    provider = recipe.provider.model_copy(deep=True)
    if base_url:
        provider = Provider.model_validate({**provider.model_dump(mode="json"), "base_url": base_url})
    if _is_placeholder(provider.base_url):
        raise RecipeError(f"{recipe.info.name}: pass --base-url with the real address of this service (the recipe only has a placeholder)")
    if secret_ref:
        auth = {**provider.auth.model_dump(mode="json"), "secret_ref": secret_ref}
        provider = Provider.model_validate({**provider.model_dump(mode="json"), "auth": auth})

    written: list[str] = []

    def put(kind: str, obj: BaseModel) -> None:
        existing = store.etag(kind, obj.id)  # type: ignore[attr-defined]
        if existing is not None and not overwrite:
            return
        store.save(kind, obj, etag=existing)
        written.append(f"{kind}:{obj.id}")

    put("provider", provider)
    for request in recipe.requests:
        put("request", request)
    for card in recipe.cards:
        put("card", card)
    for action in recipe.actions:
        put("action", action)
    return written
