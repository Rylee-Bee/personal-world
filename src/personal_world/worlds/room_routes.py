"""Owner-only routes for room/0 providers: what the rooms are, and which of their actions to adopt."""

from __future__ import annotations

from typing import Callable

from fastapi import Depends, FastAPI, HTTPException

from .authn import Principal
from .room0 import RoomService


def register_room_routes(app: FastAPI, rooms: RoomService, *, owner: Callable[..., Principal]) -> None:
    @app.get("/api/rooms")
    def list_rooms(p: Principal = Depends(owner)) -> list[dict]:
        return rooms.rooms()

    @app.get("/api/rooms/{provider_id}/actions")
    def action_candidates(provider_id: str, p: Principal = Depends(owner)) -> list[dict]:
        found = rooms.candidates(provider_id)
        if found is None:
            raise HTTPException(status_code=404, detail="no such room")
        return found

    @app.post("/api/rooms/{provider_id}/actions/{room_action_id}/adopt")
    def adopt(provider_id: str, room_action_id: str, p: Principal = Depends(owner)) -> dict:
        """Make a room's action callable (never exposed to agents, approval always). Sends nothing."""
        action = rooms.adopt(provider_id, room_action_id)
        if action is None:
            raise HTTPException(status_code=404, detail="no such room action")
        return {"action_id": action.id, "exposed": action.exposed, "approval": action.approval, "access": action.access}
