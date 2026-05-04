"""
In-memory repository stubs.
Used until Engineer 2 provides real implementations.
Thread-safe via threading.Lock.
"""
from __future__ import annotations

import threading
from typing import Literal

from schemas import SignalEvent, RiskScore, Incident


class DictSignalEventRepo:
    def __init__(self) -> None:
        self._events: list[SignalEvent] = []
        self._lock = threading.Lock()

    def append(self, event: SignalEvent) -> None:
        with self._lock:
            self._events.append(event)

    def recent(self, n: int = 50) -> list[SignalEvent]:
        with self._lock:
            return self._events[-n:]

    def clear(self) -> None:
        with self._lock:
            self._events.clear()


class DictRiskScoreRepo:
    def __init__(self) -> None:
        self._scores: dict[str, RiskScore] = {}
        self._lock = threading.Lock()

    def upsert(self, score: RiskScore) -> None:
        with self._lock:
            self._scores[score.lga_id] = score

    def get(self, lga_id: str) -> RiskScore | None:
        with self._lock:
            return self._scores.get(lga_id)

    def all(self) -> list[RiskScore]:
        with self._lock:
            return list(self._scores.values())


class DictIncidentRepo:
    def __init__(self) -> None:
        self._incidents: dict[str, Incident] = {}
        self._lock = threading.Lock()

    def upsert(self, incident: Incident) -> None:
        with self._lock:
            self._incidents[incident.incident_id] = incident

    def get(self, incident_id: str) -> Incident | None:
        with self._lock:
            return self._incidents.get(incident_id)

    def set_phase(
        self,
        incident_id: str,
        phase: Literal["active", "recovery", "resolved"],
    ) -> None:
        with self._lock:
            if incident_id in self._incidents:
                self._incidents[incident_id] = self._incidents[incident_id].model_copy(
                    update={"phase": phase}
                )
