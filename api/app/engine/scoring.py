"""Explainable LGA risk aggregation from current feature windows."""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.schemas import FeatureWindow, RiskScore, Severity
from app.engine.config import RiskScoringConfig


class RiskScorer:
    """Aggregate the top-k anomalies with visible, fixed rank weights."""

    def __init__(self, config: RiskScoringConfig | None = None) -> None:
        self.config = config or RiskScoringConfig()

    def score(
        self,
        lga_id: str,
        features: list[FeatureWindow],
        updated_at: datetime | None = None,
    ) -> RiskScore:
        relevant = [feature for feature in features if feature.lga_id == lga_id]
        ranked = sorted(
            relevant,
            key=lambda item: (-item.anomaly_score, item.domain, item.kpi),
        )[: self.config.top_k]

        if ranked:
            weights = self.config.contributor_weights[: len(ranked)]
            aggregate = sum(
                feature.anomaly_score * weight
                for feature, weight in zip(ranked, weights, strict=True)
            ) / sum(weights)
            score_value = round(aggregate * 100, 2)
            score_time = updated_at or max(feature.updated_at for feature in relevant)
            breach_times = [
                feature.time_to_breach_minutes
                for feature in ranked
                if feature.time_to_breach_minutes is not None
            ]
            time_to_breach = min(breach_times) if breach_times else None
        else:
            score_value = 0.0
            score_time = updated_at or datetime.now(timezone.utc)
            time_to_breach = None

        # Confidence describes the amount of observed input, not whether those
        # observations corroborate an incident.  Normal/warm-up features count
        # because they still increase our knowledge of the LGA's current state.
        total_samples = sum(feature.sample_count for feature in relevant)
        confidence = min(
            1.0,
            total_samples / self.config.confidence_sample_target,
        )

        return RiskScore(
            lga_id=lga_id,
            score=score_value,
            severity=self.severity_for(score_value),
            confidence=round(confidence, 4),
            time_to_breach_minutes=time_to_breach,
            updated_at=score_time,
        )

    def severity_for(self, score: float) -> Severity:
        if score < self.config.amber_threshold:
            return "green"
        if score <= self.config.red_threshold:
            return "amber"
        return "red"
