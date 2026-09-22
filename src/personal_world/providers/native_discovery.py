"""Native Discovery provider: generic content discovery for Project Worlds.

This is the native Discovery product that ships with Project Worlds.
It provides generic capabilities for:
- Content discovery from configurable sources
- Interest tracking
- Recommendation generation
- Feedback collection
- Provenance tracking

Users configure their own discovery sources through site profiles.
The candy-dispenser is one possible provider, not the only one.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..envelope import Result, fail, ok
from ..status import Status
from .registry import Contract, StatusContract
from ..discovery.sources import SOURCE_TYPES as _ENGINE_SOURCE_TYPES
from ..discovery.world_run import run_world


class ContentItem:
    """Represents a discovered content item."""

    def __init__(
        self,
        id: str,
        title: str,
        source: str,
        content_type: str,
        url: str | None = None,
        description: str | None = None,
        tags: list[str] | None = None,
        discovered_at: datetime | None = None,
        provenance: dict[str, Any] | None = None,
    ):
        self.id = id
        self.title = title
        self.source = source
        self.content_type = content_type
        self.url = url
        self.description = description
        self.tags = tags or []
        self.discovered_at = discovered_at or datetime.now(timezone.utc)
        self.provenance = provenance or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "source": self.source,
            "content_type": self.content_type,
            "url": self.url,
            "description": self.description,
            "tags": self.tags,
            "discovered_at": self.discovered_at.isoformat(),
            "provenance": self.provenance,
        }


class Interest:
    """Represents a user interest."""

    def __init__(
        self,
        id: str,
        name: str,
        category: str | None = None,
        weight: float = 1.0,
        created_at: datetime | None = None,
    ):
        self.id = id
        self.name = name
        self.category = category
        self.weight = weight
        self.created_at = created_at or datetime.now(timezone.utc)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "weight": self.weight,
            "created_at": self.created_at.isoformat(),
        }


class DiscoverySource:
    """Represents a content discovery source."""

    def __init__(
        self,
        id: str,
        name: str,
        source_type: str,
        config: dict[str, Any],
        enabled: bool = True,
    ):
        self.id = id
        self.name = name
        self.source_type = source_type
        self.config = config
        self.enabled = enabled

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "source_type": self.source_type,
            "config": self.config,
            "enabled": self.enabled,
        }


class NativeDiscovery(StatusContract):
    """Native content discovery engine."""

    def __init__(self, config_path: Path | None = None):
        self.config_path = (
            config_path or Path("~/.config/personal-world/discovery.json").expanduser()
        )
        self._sources: dict[str, DiscoverySource] = {}
        self._interests: dict[str, Interest] = {}
        self._items: dict[str, ContentItem] = {}
        self._feedback: dict[str, dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        """Load discovery configuration."""
        if self.config_path.exists():
            try:
                data = json.loads(self.config_path.read_text())
                for s in data.get("sources", []):
                    self._sources[s["id"]] = DiscoverySource(**s)
                for i in data.get("interests", []):
                    payload = dict(i)
                    # created_at round-trips through JSON as an ISO
                    # string; rehydrate it so to_dict() stays honest
                    if isinstance(payload.get("created_at"), str):
                        try:
                            payload["created_at"] = datetime.fromisoformat(
                                payload["created_at"]
                            )
                        except ValueError:
                            payload["created_at"] = None
                    self._interests[payload["id"]] = Interest(**payload)
            except (json.JSONDecodeError, OSError):
                pass

    def observe(self) -> Result:
        """Return current discovery status."""
        sources = [s.to_dict() for s in self._sources.values()]
        interests = [i.to_dict() for i in self._interests.values()]
        items = [i.to_dict() for i in self._items.values()]

        return ok(
            Status.HEALTHY.value,
            data={
                "sources": sources,
                "interests": interests,
                "items": items,
                "source_count": len(sources),
                "interest_count": len(interests),
                "item_count": len(items),
            },
        )

    def discover(self, source_id: str | None = None) -> Result:
        """Discover content from sources."""
        if source_id:
            source = self._sources.get(source_id)
            if not source:
                return fail(
                    Status.NOT_CONFIGURED.value,
                    warnings=[f"no source with id '{source_id}'"],
                )
            sources = [source]
        else:
            sources = [s for s in self._sources.values() if s.enabled]

        discovered = []
        for source in sources:
            items = self._discover_from_source(source)
            discovered.extend(items)

        return ok(
            Status.HEALTHY.value,
            data={
                "items": [i.to_dict() for i in discovered],
                "count": len(discovered),
                "sources_queried": len(sources),
            },
        )

    def _discover_from_source(self, source: DiscoverySource) -> list[ContentItem]:
        """Discover content from a single source."""
        # Generic implementation - specific source types override
        if source.source_type == "rss":
            return self._discover_rss(source)
        elif source.source_type == "api":
            return self._discover_api(source)
        elif source.source_type in _ENGINE_SOURCE_TYPES:
            return self._discover_engine(source)
        return []

    def _discover_engine(self, source: DiscoverySource) -> list[ContentItem]:
        """Engine-backed sources (github_releases, …) run through the
        vendored per-world seam: per-source state, capture mode (the world
        surfaces finds natively — no push channel required), the engine's
        own dedup/cap/isolation guarantees preserved."""
        state_path = self.config_path.parent / f"{self.config_path.name}.{source.id}.engine.json"
        world = {
            "name": source.id,
            "sources": {"s": {"type": source.source_type, "enabled": True, **source.config}},
        }
        try:
            res = run_world(world, state_path)
        except Exception:  # noqa: BLE001 — a dead source must not break the view
            return []
        items = []
        for d in res["discovered"]:
            items.append(ContentItem(
                id=f"{source.id}:{d['id']}",
                title=d["title"],
                source=source.name,
                content_type=source.config.get("content_type", "update"),
                url=d.get("url"),
                provenance={
                    "engine": "candy-dispenser discovery (vendored)",
                    "source_type": source.source_type,
                },
            ))
        return items

    def _discover_rss(self, source: DiscoverySource) -> list[ContentItem]:
        """Discover from RSS feed."""
        import urllib.request
        import xml.etree.ElementTree as ET

        url = source.config.get("url")
        if not url:
            return []

        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                root = ET.fromstring(resp.read())

            items = []
            for item in root.findall(".//item"):
                title = item.findtext("title", "")
                link = item.findtext("link", "")
                description = item.findtext("description", "")

                content_item = ContentItem(
                    id=f"{source.id}:{hash(link)}",
                    title=title,
                    source=source.name,
                    content_type="article",
                    url=link,
                    description=description,
                )
                items.append(content_item)

            return items
        except Exception:
            return []

    def _discover_api(self, source: DiscoverySource) -> list[ContentItem]:
        """Discover from API."""
        # Generic API discovery - specific implementations override
        return []

    def add_source(self, source: DiscoverySource) -> None:
        """Add a discovery source."""
        self._sources[source.id] = source
        self._save()

    def remove_source(self, source_id: str) -> None:
        """Remove a discovery source."""
        self._sources.pop(source_id, None)
        self._save()

    def add_interest(self, interest: Interest) -> None:
        """Add an interest."""
        self._interests[interest.id] = interest
        self._save()

    def remove_interest(self, interest_id: str) -> None:
        """Remove an interest."""
        self._interests.pop(interest_id, None)
        self._save()

    def record_feedback(self, item_id: str, feedback: dict[str, Any]) -> None:
        """Record feedback on a discovered item."""
        self._feedback[item_id] = {
            "item_id": item_id,
            "feedback": feedback,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        self._save()

    def _save(self) -> None:
        """Save configuration."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "schema_version": 1,
            "sources": [s.to_dict() for s in self._sources.values()],
            "interests": [i.to_dict() for i in self._interests.values()],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self.config_path.write_text(json.dumps(data, indent=2))


class RSSDiscoverySource(DiscoverySource):
    """RSS-based discovery source."""

    def __init__(self, id: str, name: str, url: str, tags: list[str] | None = None):
        super().__init__(
            id=id,
            name=name,
            source_type="rss",
            config={"url": url, "tags": tags or []},
        )


class APIDiscoverySource(DiscoverySource):
    """API-based discovery source."""

    def __init__(
        self, id: str, name: str, url: str, auth: dict[str, Any] | None = None
    ):
        super().__init__(
            id=id,
            name=name,
            source_type="api",
            config={"url": url, "auth": auth or {}},
        )
