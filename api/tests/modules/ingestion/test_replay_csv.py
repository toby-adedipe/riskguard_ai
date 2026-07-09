from __future__ import annotations

import unittest
from pathlib import Path

from app.modules.ingestion import ReplaySource


REPLAY_DIR = Path(__file__).parents[3] / "app" / "demo_data" / "replays"


class ReplayCsvTest(unittest.TestCase):
    def test_ikeja_fixture_preserves_chronology_and_cliff(self) -> None:
        content = (REPLAY_DIR / "ikeja_fibre_cliff.csv").read_text(encoding="utf-8")

        events = list(
            ReplaySource(
                content=content,
                format="csv",
                source_name="ikeja-fixture",
            ).stream()
        )

        self.assertEqual(len(events), 16)
        timestamps = [event.timestamp for event in events]
        self.assertEqual(timestamps, sorted(timestamps))
        self.assertTrue(all(event.value > 99 for event in events[:12]))
        self.assertLess(events[-1].value, 20)
        self.assertEqual(events[-1].dimensions.cluster_id, "ikeja-west")
        self.assertEqual(events[-1].source_system, "ikeja-fixture")
        self.assertEqual(len({event.event_id for event in events}), len(events))

    def test_generated_ids_are_stable_for_the_same_normalized_record(self) -> None:
        content = (REPLAY_DIR / "normal_noisy_control.csv").read_text(encoding="utf-8")
        source = ReplaySource(
            content=content,
            format="csv",
            source_name="normal-control",
        )

        first_read = list(source.stream())
        second_read = list(source.stream())

        self.assertEqual(
            [(event.event_id, event.evidence_id) for event in first_read],
            [(event.event_id, event.evidence_id) for event in second_read],
        )
        self.assertTrue(all(event.event_id.startswith("evt:") for event in first_read))
        self.assertTrue(all((event.evidence_id or "").startswith("evd:") for event in first_read))

    def test_column_mapping_normalizes_vendor_names_and_dimensions(self) -> None:
        content = (
            "observed_at,area,domain,metric,reading,site\n"
            "2026-06-01T09:00:00Z,ikeja,network,cell_availability_pct,99.7,site-42\n"
        )

        event = next(
            ReplaySource(
                content=content,
                format="csv",
                column_mapping={
                    "observed_at": "timestamp",
                    "area": "lga_id",
                    "metric": "kpi",
                    "reading": "value",
                    "site": "dimensions.site_id",
                },
                source_name="vendor-export",
            ).stream()
        )

        self.assertEqual(event.lga_id, "ikeja")
        self.assertEqual(event.value, 99.7)
        self.assertEqual(event.dimensions.site_id, "site-42")
        self.assertEqual(event.source_system, "vendor-export")


if __name__ == "__main__":
    unittest.main()
