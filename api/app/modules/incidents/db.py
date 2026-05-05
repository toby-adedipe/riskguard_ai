from app.core.schemas import Incident, IncidentPhase


class IncidentRepository:
    def __init__(self) -> None:
        self._incidents: dict[str, Incident] = {}

    def upsert(self, incident: Incident) -> None:
        self._incidents[incident.incident_id] = incident

    def get(self, incident_id: str) -> Incident | None:
        return self._incidents.get(incident_id)

    def set_phase(self, incident_id: str, phase: IncidentPhase) -> None:
        existing = self._incidents.get(incident_id)
        if existing is None:
            return
        self._incidents[incident_id] = existing.model_copy(update={"phase": phase})

    def list_all(self) -> list[Incident]:
        return list(self._incidents.values())

    def clear(self) -> None:
        self._incidents = {}


_repo = IncidentRepository()


def get_incident_repo() -> IncidentRepository:
    return _repo
