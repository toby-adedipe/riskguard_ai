from app.modules.incidents.schemas import IncidentResponse
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository


class IncidentService:
    def __init__(
        self,
        repo: IncidentRepository,
        risk_repo: RiskScoreRepository,
    ) -> None:
        self._repo = repo
        self._risk_repo = risk_repo

    def get(self, incident_id: str) -> IncidentResponse | None:
        incident = self._repo.get(incident_id)
        if incident is None:
            return None

        risk = self._risk_repo.get(incident.lga_id)
        return IncidentResponse(
            **incident.model_dump(),
            risk_score=float(risk.score) if risk is not None else None,
            time_to_breach_minutes=risk.time_to_breach_minutes if risk is not None else None,
        )
