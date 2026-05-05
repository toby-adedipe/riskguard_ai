from app.core.schemas import RiskScore


class RiskScoreRepository:
    def __init__(self) -> None:
        self._scores: dict[str, RiskScore] = {}

    def upsert(self, score: RiskScore) -> None:
        self._scores[score.lga_id] = score

    def clear(self) -> None:
        self._scores = {}

    def exists(self, lga_id: str) -> bool:
        return lga_id in self._scores

    def list_all(self) -> list[RiskScore]:
        return list(self._scores.values())

    def get(self, lga_id: str) -> RiskScore | None:
        return self._scores.get(lga_id)


_repo = RiskScoreRepository()


def get_risk_repo() -> RiskScoreRepository:
    return _repo
