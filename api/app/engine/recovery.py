from datetime import datetime, timezone
from typing import Optional
from app.core.schemas import RiskScore


class RecoveryModel:
    def __init__(self, incident_id: str, start_score: float = 87.0, floor: float = 42.0, steps: int = 12) -> None:
        self.incident_id = incident_id
        self.current = start_score
        self.floor = floor
        self.steps = steps
        self.step = 0

    def tick(self) -> RiskScore:
        # Linear decay from start to floor over steps
        if self.step >= self.steps:
            self.current = self.floor
        else:
            decay = (87.0 - self.floor) / self.steps
            self.current = max(self.floor, 87.0 - decay * (self.step + 1))
            self.step += 1
        return RiskScore(lga_id="IKEJA", score=self.current, severity=("red" if self.current > 60 else "amber" if self.current>40 else "green"), confidence=0.9, time_to_breach_minutes=None, updated_at=datetime.now(timezone.utc))

    def is_complete(self) -> bool:
        return self.current <= self.floor
