from app.core.schemas import Incident
from app.modules.incidents.db import IncidentRepository
from app.engine import runtime


class IncidentService:
    def __init__(self, repo: IncidentRepository) -> None:
        self._repo = repo

    def get(self, incident_id: str) -> Incident | None:
        try:
            inc = runtime.impact_builder.build(incident_id)
            if inc:
                return inc
        except Exception:
            pass
        return self._repo.get(incident_id)
