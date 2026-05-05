from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.core.schemas import FeatureWindow, Incident, InvestigationTrigger, RiskScore


class WakeConditionEvaluator:
    def __init__(
        self,
        *,
        minimum_score: float = 65.0,
        minimum_confidence: float = 0.75,
        maximum_time_to_breach_minutes: int = 60,
        minimum_domain_anomaly_score: float = 0.8,
        minimum_triggered_domains: int = 2,
    ) -> None:
        self._minimum_score = minimum_score
        self._minimum_confidence = minimum_confidence
        self._maximum_time_to_breach_minutes = maximum_time_to_breach_minutes
        self._minimum_domain_anomaly_score = minimum_domain_anomaly_score
        self._minimum_triggered_domains = minimum_triggered_domains

    def evaluate(
        self,
        score: RiskScore,
        feature_windows: list[FeatureWindow],
        incident: Incident | None,
    ) -> InvestigationTrigger | None:
        triggered_domains = sorted(
            {
                window.domain
                for window in feature_windows
                if window.anomaly_score >= self._minimum_domain_anomaly_score
            }
        )

        is_score_eligible = (
            score.score >= self._minimum_score
            and score.confidence >= self._minimum_confidence
        )
        is_breach_close = (
            score.time_to_breach_minutes is not None
            and score.time_to_breach_minutes <= self._maximum_time_to_breach_minutes
        )
        is_multi_domain = len(triggered_domains) >= self._minimum_triggered_domains

        if not is_score_eligible:
            return None

        reasons = []
        reasons.append(
            f"score {score.score:.1f} with confidence {score.confidence:.2f}"
        )
        if is_breach_close and score.time_to_breach_minutes is not None:
            reasons.append(
                f"time to breach {score.time_to_breach_minutes} minutes"
            )
        if is_multi_domain:
            reasons.append(f"domains {', '.join(triggered_domains)} crossed anomaly threshold")

        return InvestigationTrigger(
            trigger_id=str(uuid4()),
            lga_id=score.lga_id,
            incident_id=incident.incident_id if incident else None,
            trigger_type="threshold",
            score=score.score,
            confidence=score.confidence,
            time_to_breach_minutes=score.time_to_breach_minutes,
            triggered_domains=triggered_domains,
            reason="; ".join(reasons),
            created_at=datetime.now(timezone.utc),
        )
