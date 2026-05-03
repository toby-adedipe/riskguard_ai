from __future__ import annotations

from data_engine.schemas import RiskScore


class RecoveryModel:
    def __init__(self, incident_id: str) -> None:
        ...

    def tick(self) -> RiskScore:
        """
        Advances recovery one step along IKEJA_RECOVERY_TRAJECTORY.
        Score reaches ≤ 42 by tick 12, never goes below 42.
        """
        ...
