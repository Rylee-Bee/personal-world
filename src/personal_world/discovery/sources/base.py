"""Source adapter protocol."""

from typing import Protocol


class SourceAdapter(Protocol):
    name: str
    enabled: bool
    interval: int

    def poll(self, state: dict) -> list[dict]: ...
    def render(self, item: dict) -> tuple[str, str, str, str | None, str | None]: ...
