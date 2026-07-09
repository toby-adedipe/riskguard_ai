from __future__ import annotations

import unittest

from app.modules.ingestion import ReplaySource, ReplayValidationError


class ReplayValidationTest(unittest.TestCase):
    def test_missing_required_field_reports_csv_row(self) -> None:
        content = (
            "timestamp,lga_id,domain,kpi\n"
            "2026-06-01T09:00:00Z,ikeja,network,cell_availability_pct\n"
        )

        with self.assertRaises(ReplayValidationError) as raised:
            list(ReplaySource(content=content, format="csv", source_name="missing-value").stream())

        self.assertEqual(raised.exception.row_number, 2)
        self.assertIn("missing required fields: value", str(raised.exception))

    def test_unknown_field_reports_jsonl_row(self) -> None:
        content = (
            '{"timestamp":"2026-06-01T09:00:00Z","lga_id":"ikeja",'
            '"domain":"network","kpi":"cell_availability_pct","value":99.7}\n'
            '{"timestamp":"2026-06-01T09:05:00Z","lga_id":"ikeja",'
            '"domain":"network","kpi":"cell_availability_pct","value":99.6,'
            '"mystery":"nope"}\n'
        )

        with self.assertRaises(ReplayValidationError) as raised:
            source = ReplaySource(
                content=content,
                format="jsonl",
                source_name="unknown-field",
            )
            list(source.stream())

        self.assertEqual(raised.exception.row_number, 2)
        self.assertIn("unknown field 'mystery'", str(raised.exception))

    def test_invalid_schema_value_is_wrapped_with_row_context(self) -> None:
        content = (
            "timestamp,lga_id,domain,kpi,value\n"
            "2026-06-01T09:00:00Z,ikeja,network,not_a_kpi,99.7\n"
        )

        with self.assertRaises(ReplayValidationError) as raised:
            list(ReplaySource(content=content, format="csv", source_name="bad-kpi").stream())

        self.assertEqual(raised.exception.row_number, 2)
        self.assertIn("kpi:", str(raised.exception))

    def test_mapping_collision_fails_closed(self) -> None:
        content = (
            "timestamp,lga_id,area,domain,kpi,value\n"
            "2026-06-01T09:00:00Z,ikeja,ikeja,network,cell_availability_pct,99.7\n"
        )

        with self.assertRaises(ReplayValidationError) as raised:
            list(
                ReplaySource(
                    content=content,
                    format="csv",
                    column_mapping={"area": "lga_id"},
                    source_name="mapping-collision",
                ).stream()
            )

        self.assertEqual(raised.exception.row_number, 2)
        self.assertIn("multiple source fields map to 'lga_id'", str(raised.exception))

    def test_unknown_nested_dimension_fails_closed(self) -> None:
        content = (
            '{"timestamp":"2026-06-01T09:00:00Z","lga_id":"ikeja",'
            '"domain":"network","kpi":"cell_availability_pct","value":99.7,'
            '"dimensions":{"rack_colour":"blue"}}\n'
        )

        with self.assertRaises(ReplayValidationError) as raised:
            list(ReplaySource(content=content, format="jsonl").stream())

        self.assertEqual(raised.exception.row_number, 1)
        self.assertIn("unknown dimension fields: rack_colour", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
