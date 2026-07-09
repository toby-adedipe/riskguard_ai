from __future__ import annotations

import unittest
from pathlib import Path

from app.modules.ingestion import ReplaySource


REPLAY_DIR = Path(__file__).parents[3] / "app" / "demo_data" / "replays"


class ReplayJsonlTest(unittest.TestCase):
    def test_surulere_fixture_preserves_nested_dimensions_and_swell(self) -> None:
        content = (REPLAY_DIR / "surulere_congestion.jsonl").read_text(encoding="utf-8")

        events = list(
            ReplaySource(
                content=content,
                format="jsonl",
                source_name="surulere-fixture",
            ).stream()
        )

        self.assertEqual(len(events), 16)
        timestamps = [event.timestamp for event in events]
        self.assertEqual(timestamps, sorted(timestamps))
        self.assertTrue(all(event.value < 17 for event in events[:12]))
        self.assertEqual(
            [event.value for event in events[-4:]],
            [17.5, 18.5, 19.5, 20.5],
        )
        self.assertEqual(events[-1].dimensions.cluster_id, "surulere-core")
        self.assertEqual(events[-1].dimensions.service_type, "mobile_data")

    def test_supplied_ids_are_preserved(self) -> None:
        content = (
            '{"event_id":"vendor-event-1","evidence_id":"vendor-evidence-1",'
            '"timestamp":"2026-06-01T12:00:00Z","lga_id":"surulere",'
            '"domain":"network","kpi":"congestion_rate_pct","value":14.2}\n'
        )

        event = next(ReplaySource(content=content, format="jsonl").stream())

        self.assertEqual(event.event_id, "vendor-event-1")
        self.assertEqual(event.evidence_id, "vendor-evidence-1")


if __name__ == "__main__":
    unittest.main()
