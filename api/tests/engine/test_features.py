from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from app.core.schemas import SignalEvent
from app.engine import FeatureEngine, FeatureEngineConfig


NOW = datetime(2026, 7, 9, 12, 0, tzinfo=timezone.utc)


def event(
    event_id: str,
    value: float,
    *,
    kpi: str = "cell_availability_pct",
    domain: str = "network",
    lga_id: str = "ikeja",
    baseline_value: float | None = None,
    minute: int = 0,
) -> SignalEvent:
    return SignalEvent.model_validate(
        {
            "event_id": event_id,
            "lga_id": lga_id,
            "domain": domain,
            "kpi": kpi,
            "value": value,
            "unit": "pct",
            "source_system": "test-replay",
            "baseline_value": baseline_value,
            "timestamp": NOW + timedelta(minutes=minute),
        }
    )


class FeatureEngineTest(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = FeatureEngine(
            FeatureEngineConfig(
                window_size=8,
                min_baseline_samples=3,
                relative_dispersion_floor=0.001,
                evidence_threshold=0.4,
            )
        )

    def test_warmup_without_provided_baseline_does_not_claim_anomaly(self) -> None:
        feature, evidence = self.engine.update(event("evt-1", 70.0))

        self.assertEqual(feature.baseline_method, None)
        self.assertEqual(feature.expected_value, 70.0)
        self.assertEqual(feature.harmful_z_score, 0.0)
        self.assertEqual(feature.anomaly_score, 0.0)
        self.assertIsNone(evidence)

    def test_provided_baseline_enables_scoring_during_warmup(self) -> None:
        feature, evidence = self.engine.update(
            event("evt-baseline", 70.0, baseline_value=100.0)
        )

        self.assertEqual(feature.baseline_method, "provided_baseline")
        self.assertEqual(feature.expected_value, 100.0)
        self.assertGreater(feature.harmful_z_score or 0.0, 0.0)
        self.assertEqual(feature.anomaly_score, 1.0)
        self.assertIsNotNone(evidence)
        assert evidence is not None
        self.assertEqual(evidence.expected_value, feature.expected_value)
        self.assertEqual(evidence.dispersion, feature.dispersion)
        self.assertEqual(evidence.baseline_method, feature.baseline_method)
        self.assertEqual(evidence.harmful_z_score, feature.harmful_z_score)
        self.assertEqual(evidence.z_score, feature.z_score)

    def test_rolling_median_mad_uses_only_prior_samples(self) -> None:
        for index, value in enumerate((99.0, 100.0, 101.0)):
            self.engine.update(event(f"evt-{index}", value, minute=index))

        feature, evidence = self.engine.update(event("evt-cliff", 70.0, minute=4))

        self.assertEqual(feature.baseline_method, "global_median_mad")
        self.assertEqual(feature.expected_value, 100.0)
        self.assertEqual(feature.dispersion, 1.0)
        self.assertAlmostEqual(feature.z_score, -20.235)
        self.assertEqual(feature.anomaly_score, 1.0)
        self.assertIsNotNone(evidence)

    def test_benign_direction_is_recorded_but_not_emitted_as_evidence(self) -> None:
        feature, evidence = self.engine.update(
            event("evt-benign", 105.0, baseline_value=100.0)
        )

        self.assertGreater(feature.z_score, 0)
        self.assertEqual(feature.harmful_z_score, 0.0)
        self.assertEqual(feature.anomaly_score, 0.0)
        self.assertEqual(feature.evidence_ids, [])
        self.assertIsNone(evidence)

    def test_higher_is_worse_kpi_emits_thresholded_evidence(self) -> None:
        feature, evidence = self.engine.update(
            event(
                "evt-complaints",
                80.0,
                kpi="complaint_volume",
                domain="complaints",
                baseline_value=10.0,
            )
        )

        self.assertGreater(feature.z_score, 0)
        self.assertEqual(feature.anomaly_score, 1.0)
        self.assertIsNotNone(evidence)

    def test_generated_evidence_id_is_stable_for_the_same_event(self) -> None:
        signal = event("evt-stable", 70.0, baseline_value=100.0)
        first = self.engine.update(signal)[1]
        second = FeatureEngine(self.engine.config).update(signal)[1]

        self.assertIsNotNone(first)
        self.assertIsNotNone(second)
        assert first is not None and second is not None
        self.assertEqual(first.evidence_id, second.evidence_id)
        self.assertTrue(first.evidence_id.startswith("evd:"))

    def test_latest_for_lga_returns_one_window_per_kpi(self) -> None:
        self.engine.update(event("evt-a", 99.0))
        self.engine.update(event("evt-b", 98.0, minute=1))
        self.engine.update(
            event(
                "evt-c",
                12.0,
                kpi="complaint_volume",
                domain="complaints",
                lga_id="ikeja",
            )
        )
        self.engine.update(event("evt-d", 75.0, lga_id="surulere"))

        latest = self.engine.latest_for_lga("ikeja")

        self.assertEqual(len(latest), 2)
        by_kpi = {feature.kpi: feature for feature in latest}
        self.assertEqual(by_kpi["cell_availability_pct"].current_value, 98.0)
        self.assertEqual(by_kpi["complaint_volume"].current_value, 12.0)


if __name__ == "__main__":
    unittest.main()
