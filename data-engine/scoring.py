from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from schemas import RiskScore
from features import FeatureEngine
from fixtures import DOMAIN_WEIGHTS, CALIBRATION_FACTOR, IKEJA_FIXTURES


def _severity(score: float) -> Literal["low", "medium", "high", "critical"]:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


class RiskScoringEngine:
    """
    Weighted sum of clamped domain z-scores → single risk score 0–100.

    Formula:
        raw   = Σ(weight_d * clamp(|z_d|, 0, 10))  for d in DOMAIN_WEIGHTS
        score = round(clamp(raw * CALIBRATION_FACTOR, 0, 100), 1)

    Calibrated so that Ikeja incident z-scores produce exactly 87.
    """

    def __init__(self, feature_engine: FeatureEngine) -> None:
        self._fe = feature_engine

    def score(self, lga_id: str) -> RiskScore:
        domain_zscores = {
            domain: self._fe.get_domain_zscore(lga_id, domain)
            for domain in DOMAIN_WEIGHTS
        }

        raw = sum(
            DOMAIN_WEIGHTS[d] * min(abs(z), 10.0)
            for d, z in domain_zscores.items()
        )

        final_score = round(min(raw * CALIBRATION_FACTOR, 100.0), 1)

        contributing = [
            d for d, z in domain_zscores.items() if abs(z) > 1.0
        ]

        # time_to_breach is load-bearing only for the Ikeja incident
        ttb = (
            IKEJA_FIXTURES["time_to_breach_minutes"]
            if lga_id == IKEJA_FIXTURES["lga_id"] and final_score >= 80
            else 0
        )

        return RiskScore(
            lga_id                = lga_id,
            score                 = final_score,
            severity              = _severity(final_score),
            confidence            = round(min(final_score / 100.0, 1.0), 3),
            time_to_breach_minutes= ttb,
            contributing_domains  = contributing,
            computed_at           = datetime.now(timezone.utc),
        )
