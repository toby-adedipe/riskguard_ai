"""Append-only in-memory event log for the live demo stream.

Events are produced by `live_trigger` and consumed by the frontend via the
`GET /simulation/events?since=N` polling endpoint. Each event has a monotonic
`id`; clients track `lastSeenId` and ask for events strictly greater.
"""
from __future__ import annotations

import threading
import time
from typing import Any


class EventLog:
    def __init__(self, capacity: int = 2000) -> None:
        self._capacity = capacity
        self._events: list[dict[str, Any]] = []
        self._next_id = 1
        self._lock = threading.Lock()
        self._session_id: str | None = None

    def reset(self, session_id: str) -> None:
        with self._lock:
            self._events.clear()
            self._next_id = 1
            self._session_id = session_id

    def append(self, type_: str, **payload: Any) -> dict[str, Any]:
        with self._lock:
            event = {
                "id": self._next_id,
                "session_id": self._session_id,
                "ts": time.time(),
                "type": type_,
                **payload,
            }
            self._next_id += 1
            self._events.append(event)
            if len(self._events) > self._capacity:
                # Drop oldest while preserving monotonic IDs.
                self._events = self._events[-self._capacity :]
            return event

    def since(self, since_id: int) -> list[dict[str, Any]]:
        with self._lock:
            if not self._events or since_id >= self._events[-1]["id"]:
                return []
            return [event for event in self._events if event["id"] > since_id]

    def session_id(self) -> str | None:
        with self._lock:
            return self._session_id


_event_log = EventLog()


def get_event_log() -> EventLog:
    return _event_log
