from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from app.core.schemas import FeatureWindow
from app.engine import RiskScorer, RiskScoringConfig


NOW = datetime(2026, 7, 9, 12, 0, tzinfo=timezone.utc)


def feature(
    kpi: str,
    anomaly_score: float,
    *,
    domain: str = "network",
    lga_id: str = "ikeja",
    sample_count: int = 10,
    minute: int = 0,
    time_to_breach_minutes: int | None = None,
) -> FeatureWindow:
    return FeatureWindow.model_validate(
        {
            "lga_id": lga_id,
            "domain": domain,
            "kpi": kpi,
            "window_minutes": 30,
            "current_value": 1.0,
            "rolling_mean": 1.0,
            "rolling_stddev": 0.1,
            "z_score": anomaly_score * 6,
            "delta_pct": anomaly_score * 100,
            "anomaly_score": anomaly_score,
            "sample_count": sample_count,
            "time_to_breach_minutes": time_to_breach_minutes,
            "updated_at": NOW + timedelta(minutes=minute),
        }
    )


class RiskScorerTest(unittest.TestCase):
    def test_score_uses_only_configured_top_k_with_visible_weights(self) -> None:
        scorer = RiskScorer(
            RiskScoringConfig(
                top_k=2,
                contributor_weights=(1.0, 0.5),
                confidence_sample_target=30,
            )
        )
        features = [
            feature("cell_availability_pct", 1.0),
            feature("dropped_call_rate_pct", 0.8),
            feature("congestion_rate_pct", 0.1),
        ]

        score = scorer.score("ikeja", features)

        self.assertAlmostEqual(score.score, 93.33)
        self.assertEqual(score.severity, "red")
        self.assertEqual(score.confidence, 1.0)

    def test_other_lgas_do_not_affect_score_or_confidence(self) -> None:
        scorer = RiskScorer(
            RiskScoringConfig(
                top_k=2,
                contributor_weights=(1.0, 1.0),
                confidence_sample_target=20,
            )
        )
        features = [
            feature("cell_availability_pct", 0.5, sample_count=5),
            feature(
                "cell_availability_pct",
                1.0,
                lga_id="surulere",
                sample_count=30,
            ),
        ]

        score = scorer.score("ikeja", features)

        self.assertEqual(score.score, 50.0)
        self.assertEqual(score.severity, "amber")
        self.assertEqual(score.confidence, 0.25)

    def test_normal_and_warmup_samples_increase_coverage_confidence(self) -> None:
        scorer = RiskScorer(
            RiskScoringConfig(
                top_k=2,
                contributor_weights=(1.0, 1.0),
                confidence_sample_target=20,
            )
        )
        features = [
            feature("cell_availability_pct", 0.0, sample_count=8),
            feature("dropped_call_rate_pct", 0.0, sample_count=7),
        ]

        score = scorer.score("ikeja", features)

        self.assertEqual(score.score, 0.0)
        self.assertEqual(score.severity, "green")
        self.assertEqual(score.confidence, 0.75)

    def test_empty_lga_is_green_and_honours_explicit_timestamp(self) -> None:
        scorer = RiskScorer()
        explicit_time = NOW + timedelta(hours=1)

        score = scorer.score("oshodi", [], updated_at=explicit_time)

        self.assertEqual(score.score, 0.0)
        self.assertEqual(score.severity, "green")
        self.assertEqual(score.confidence, 0.0)
        self.assertEqual(score.updated_at, explicit_time)

    def test_earliest_feature_breach_projection_is_propagated(self) -> None:
        scorer = RiskScorer(
            RiskScoringConfig(top_k=2, contributor_weights=(1.0, 1.0))
        )

        score = scorer.score(
            "ikeja",
            [
                feature(
                    "cell_availability_pct",
                    0.8,
                    time_to_breach_minutes=12,
                ),
                feature(
                    "dropped_call_rate_pct",
                    0.7,
                    time_to_breach_minutes=7,
                    minute=1,
                ),
            ],
        )

        self.assertEqual(score.time_to_breach_minutes, 7)
        self.assertEqual(score.updated_at, NOW + timedelta(minutes=1))


if __name__ == "__main__":
    unittest.main()
