from datetime import datetime, timezone
from app.core.schemas import RiskScore


class RiskScoringEngine:
    def __init__(self, features=None, repo=None) -> None:
        self._features = features
        self._repo = repo

    def score(self, lga_id: str) -> RiskScore:
        # Return current materialized score from repo if available
        if self._repo:
            existing = self._repo.get(lga_id)
            if existing is not None:
                return existing
        # Default baseline
        return RiskScore(lga_id=lga_id, score=20.0, severity="green", confidence=0.5, time_to_breach_minutes=None, updated_at=datetime.now(timezone.utc))
