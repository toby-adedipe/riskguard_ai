from typing import Dict
from app.core.schemas import SignalEvent, RiskScore, Incident


class DictSignalEventRepo:
    def __init__(self) -> None:
        self._events: list[SignalEvent] = []

    def append(self, event: SignalEvent) -> None:
        self._events.append(event)


class DictRiskScoreRepo:
    def __init__(self) -> None:
        self._scores: Dict[str, RiskScore] = {}

    def upsert(self, score: RiskScore) -> None:
        self._scores[score.lga_id] = score

    def get(self, lga_id: str) -> RiskScore | None:
        return self._scores.get(lga_id)


class DictIncidentRepo:
    def __init__(self) -> None:
        self._incidents: Dict[str, Incident] = {}

    def upsert(self, incident: Incident) -> None:
        self._incidents[incident.incident_id] = incident

    def get(self, incident_id: str) -> Incident | None:
        return self._incidents.get(incident_id)

    def set_phase(self, incident_id: str, phase: str) -> None:
        existing = self._incidents.get(incident_id)
        if existing is None:
            return
        self._incidents[incident_id] = existing.model_copy(update={"phase": phase})
