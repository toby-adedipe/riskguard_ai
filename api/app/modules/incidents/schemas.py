from app.core.schemas import Incident


class IncidentResponse(Incident):
    risk_score: float | None = None
    time_to_breach_minutes: int | None = None
