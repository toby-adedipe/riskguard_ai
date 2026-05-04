from __future__ import annotations

from datetime import datetime, timezone

from schemas import RiskScore
from fixtures import IKEJA_FIXTURES, DOMAIN_WEIGHTS
from trajectories import IKEJA_RECOVERY_TRAJECTORY


class RecoveryModel:
    """
    Advances Ikeja's risk score along IKEJA_RECOVERY_TRAJECTORY on each tick.
    Called by Engineer 2's ApprovalService after POST /actions/approve.

    - Starts at 87, floors at 42 by tick 12
    - Score never goes below recovery_floor (42)
    - Each tick = one 5-second poll cycle
    """

    def __init__(self, incident_id: str) -> None:
        self._incident_id = incident_id
        self._tick_index  = 0
        self._floor       = IKEJA_FIXTURES["recovery_floor"]

    def tick(self) -> RiskScore:
        idx   = min(self._tick_index, len(IKEJA_RECOVERY_TRAJECTORY) - 1)
        score = max(IKEJA_RECOVERY_TRAJECTORY[idx], self._floor)
        self._tick_index += 1

        severity = "critical" if score >= 80 else "high" if score >= 60 else "medium" if score >= 40 else "low"

        return RiskScore(
            lga_id                 = IKEJA_FIXTURES["lga_id"],
            score                  = score,
            severity               = severity,
            confidence             = round(score / 100.0, 3),
            time_to_breach_minutes = 0,
            contributing_domains   = list(DOMAIN_WEIGHTS.keys()),
            computed_at            = datetime.now(timezone.utc),
        )

    @property
    def is_complete(self) -> bool:
        """True once the score has reached the recovery floor."""
        return self._tick_index >= len(IKEJA_RECOVERY_TRAJECTORY)
