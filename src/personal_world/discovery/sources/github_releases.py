"""GitHub Releases source adapter. Polls public repos for new releases."""

from __future__ import annotations

import json
import logging
from typing import Any

from personal_world.discovery.http import http_get
from personal_world.discovery.notifier import _notify_batch
from personal_world.discovery.scheduler import mark_polled, should_poll

log = logging.getLogger("candy-dispenser")


class GitHubReleasesSource:
    """Discover new releases from a public GitHub repository.

    No secrets needed — the GitHub releases API is public for public repos.
    Follows the same adapter protocol as BandcampSource / TMDBSource:
    __init__(ntfy_config, ntfy_max_per_poll), poll(state), render(item).
    """

    name = "github_releases"
    enabled = True
    interval = 86400

    def __init__(self, *, ntfy_config: dict, ntfy_max_per_poll: int, config: dict | None = None):
        self._ntfy_config = ntfy_config
        self._ntfy_max_per_poll = ntfy_max_per_poll
        self._config = config or {}
        self.repo = self._config.get("repo", "")
        self.interval = self._config.get("interval", 86400)
        self.enabled = self._config.get("enabled", True)
        self.keywords = self._config.get("filter", {}).get("keywords", []) or []

    def poll(self, state: dict) -> None:
        """Poll GitHub releases API for new releases of the configured repo."""
        if not self.repo:
            log.warning(f"{self.name}: no repo configured, skipping")
            return

        source_key = f"github_releases:{self.repo}"
        if not should_poll(state, source_key, self.interval):
            return

        log.info(f"polling GitHub releases for {self.repo}...")
        url = f"https://api.github.com/repos/{self.repo}/releases?per_page=10"
        status, body = http_get(url, timeout=15)

        if status != 200:
            log.warning(f"GitHub releases {self.repo} failed ({status})")
            mark_polled(state, source_key)
            return

        try:
            releases = json.loads(body)
        except Exception:
            log.warning(f"GitHub releases {self.repo}: JSON parse failed")
            mark_polled(state, source_key)
            return

        if not isinstance(releases, list):
            log.warning(f"GitHub releases {self.repo}: unexpected response shape")
            mark_polled(state, source_key)
            return

        # Filter by keywords if configured
        if self.keywords:
            releases = [
                r
                for r in releases
                if any(
                    kw.lower() in (r.get("name") or "").lower()
                    or kw.lower() in (r.get("body") or "").lower()
                    for kw in self.keywords
                )
            ]

        # Tag each release for render()
        for r in releases:
            r["_source_key"] = source_key
            r["_repo"] = self.repo

        log.info(f"GitHub releases {self.repo}: {len(releases)} releases fetched")

        notified, skipped = _notify_batch(
            state,
            source_key,
            releases,
            self.render,
            ["package", "rocket"],
            ntfy_config=self._ntfy_config,
            max_per_poll=self._ntfy_max_per_poll,
        )
        log.info(
            f"GitHub {self.repo}: {notified} notified, {skipped} over cap"
        )
        mark_polled(state, source_key)

    def render(self, item: dict) -> tuple[str, str, str, str | None, str | None]:
        """Render a release into (dedup_id, title, body, click_url, image_url)."""
        tag = item.get("tag_name", "")
        name = item.get("name") or tag or "(untitled)"
        repo = item.get("_repo", self.repo)
        body = (item.get("body") or "")[:300] or "No release notes"
        url = item.get("html_url", "")
        published = item.get("published_at", "")
        date_part = published[:10] if published else ""

        body_text = "\n".join(
            [
                f"{repo} {name}",
                "",
                body,
                "",
                f"Released {date_part}" if date_part else "",
                url,
            ]
        ).strip()

        return (
            f"gh:{repo}:{tag}",
            f"Firmware: {repo} {name}",
            body_text,
            url or None,
            None,
        )
