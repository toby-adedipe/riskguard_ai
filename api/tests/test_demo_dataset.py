import unittest

from app.demo_data.dataset import load_demo_scenario


class DemoDatasetTest(unittest.TestCase):
    def test_presentation_fixture_is_schema_valid_and_cross_domain(self) -> None:
        scenario = load_demo_scenario()

        self.assertEqual(len(scenario.risk_scores), 1)
        self.assertEqual(len(scenario.incidents), 1)
        self.assertGreaterEqual(len(scenario.signal_events), 12)
        self.assertGreaterEqual(len(scenario.signal_evidence), 10)
        self.assertGreaterEqual(len(scenario.feature_windows), 7)
        self.assertEqual(
            {event.domain for event in scenario.signal_events},
            {
                "network",
                "bts",
                "billing",
                "sales",
                "recharge",
                "complaints",
                "device_sessions",
                "social_media",
            },
        )


if __name__ == "__main__":
    unittest.main()
