from __future__ import annotations

import unittest
from typing import get_args

from app.core.schemas import SignalKpi
from app.engine.polarity import KPI_POLARITY, harmful_z_score, polarity_for


class PolarityTest(unittest.TestCase):
    def test_every_canonical_kpi_has_an_explicit_polarity(self) -> None:
        self.assertEqual(set(KPI_POLARITY), set(get_args(SignalKpi)))

    def test_harmful_component_respects_kpi_direction(self) -> None:
        self.assertEqual(polarity_for("cell_availability_pct"), "lower_is_worse")
        self.assertEqual(harmful_z_score("cell_availability_pct", -4.5), 4.5)
        self.assertEqual(harmful_z_score("cell_availability_pct", 4.5), 0.0)

        self.assertEqual(polarity_for("complaint_volume"), "higher_is_worse")
        self.assertEqual(harmful_z_score("complaint_volume", 3.0), 3.0)
        self.assertEqual(harmful_z_score("complaint_volume", -3.0), 0.0)

    def test_unknown_kpi_is_rejected_with_context(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unknown KPI 'mystery_kpi'"):
            polarity_for("mystery_kpi")


if __name__ == "__main__":
    unittest.main()
