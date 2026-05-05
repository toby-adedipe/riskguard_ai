from app.core.schemas import RiskScore
from app.modules.risk.db import RiskScoreRepository
from app.engine import runtime


class RiskService:
    def __init__(self, repo: RiskScoreRepository) -> None:
        self._repo = repo

    def get_map(self) -> list[RiskScore]:
        try:
            # Prefer engine scoring if available
            score = runtime.scoring.score("IKEJA")
            return [score]
        except Exception:
            return self._repo.list_all()
