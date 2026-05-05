from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.core.schemas import FeatureWindow, Incident, IncidentImpact, RiskScore
from app.modules.copilot.triggering import WakeConditionEvaluator


class WakeConditionEvaluatorTestCase(unittest.TestCase):
    def test_creates_trigger_for_high_score_and_multi_domain_anomaly(self) -> None:
        evaluator = WakeConditionEvaluator()
        score = RiskScore(
            lga_id="ikeja",
            score=87.0,
            severity="red",
            confidence=0.91,
            time_to_breach_minutes=47,
            updated_at=datetime.now(timezone.utc),
        )
        windows = [
            FeatureWindow(
                lga_id="ikeja",
                domain="network",
                kpi="cell_availability_pct",
                window_minutes=15,
                current_value=61.0,
                rolling_mean=97.0,
                rolling_stddev=4.0,
                z_score=-9.0,
                delta_pct=-37.0,
                anomaly_score=0.94,
                sample_count=15,
                time_to_breach_minutes=47,
                evidence_ids=["evd:1"],
                updated_at=datetime.now(timezone.utc),
            ),
            FeatureWindow(
                lga_id="ikeja",
                domain="billing",
                kpi="failed_rating_events",
                window_minutes=15,
                current_value=180.0,
                rolling_mean=30.0,
                rolling_stddev=10.0,
                z_score=15.0,
                delta_pct=500.0,
                anomaly_score=0.82,
                sample_count=15,
                time_to_breach_minutes=47,
                evidence_ids=["evd:2"],
                updated_at=datetime.now(timezone.utc),
            ),
        ]
        incident = Incident(
            incident_id="INC-2025-IKEJA-001",
            lga_id="ikeja",
            cause="network outage",
            phase="active",
            opened_at=datetime.now(timezone.utc),
            impact=IncidentImpact(
                affected_subscribers=18420,
                enterprise_lines=312,
                revenue_at_risk_ngn=8_700_000,
                compensation_exposure_ngn=2_100_000,
                ncc_exposure_summary="High NCC exposure",
            ),
        )

        trigger = evaluator.evaluate(score, windows, incident)

        self.assertIsNotNone(trigger)
        assert trigger is not None
        self.assertEqual(trigger.incident_id, incident.incident_id)
        self.assertEqual(trigger.trigger_type, "threshold")
        self.assertIn("network", trigger.triggered_domains)
        self.assertIn("billing", trigger.triggered_domains)

    def test_returns_none_for_low_risk_single_domain_case(self) -> None:
        evaluator = WakeConditionEvaluator()
        score = RiskScore(
            lga_id="ikeja",
            score=52.0,
            severity="amber",
            confidence=0.65,
            time_to_breach_minutes=120,
            updated_at=datetime.now(timezone.utc),
        )
        windows = [
            FeatureWindow(
                lga_id="ikeja",
                domain="network",
                kpi="cell_availability_pct",
                window_minutes=15,
                current_value=89.0,
                rolling_mean=92.0,
                rolling_stddev=5.0,
                z_score=-0.6,
                delta_pct=-3.2,
                anomaly_score=0.4,
                sample_count=15,
                time_to_breach_minutes=120,
                evidence_ids=["evd:1"],
                updated_at=datetime.now(timezone.utc),
            )
        ]

        trigger = evaluator.evaluate(score, windows, incident=None)

        self.assertIsNone(trigger)

    def test_custom_score_threshold_blocks_otherwise_high_risk_case(self) -> None:
        evaluator = WakeConditionEvaluator(minimum_score=90.0)
        score = RiskScore(
            lga_id="ikeja",
            score=87.0,
            severity="red",
            confidence=0.91,
            time_to_breach_minutes=47,
            updated_at=datetime.now(timezone.utc),
        )
        windows = [
            FeatureWindow(
                lga_id="ikeja",
                domain="network",
                kpi="cell_availability_pct",
                window_minutes=15,
                current_value=61.0,
                rolling_mean=97.0,
                rolling_stddev=4.0,
                z_score=-9.0,
                delta_pct=-37.0,
                anomaly_score=0.94,
                sample_count=15,
                time_to_breach_minutes=47,
                evidence_ids=["evd:1"],
                updated_at=datetime.now(timezone.utc),
            ),
            FeatureWindow(
                lga_id="ikeja",
                domain="billing",
                kpi="failed_rating_events",
                window_minutes=15,
                current_value=180.0,
                rolling_mean=30.0,
                rolling_stddev=10.0,
                z_score=15.0,
                delta_pct=500.0,
                anomaly_score=0.82,
                sample_count=15,
                time_to_breach_minutes=47,
                evidence_ids=["evd:2"],
                updated_at=datetime.now(timezone.utc),
            ),
        ]

        trigger = evaluator.evaluate(score, windows, incident=None)

        self.assertIsNone(trigger)


if __name__ == "__main__":
    unittest.main()
