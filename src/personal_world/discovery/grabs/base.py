"""Grab adapter protocol."""

from typing import Protocol


class GrabAdapter(Protocol):
    def grab(self, item: dict, config: dict) -> bool: ...
