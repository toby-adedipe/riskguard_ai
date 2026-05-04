from __future__ import annotations

from datetime import datetime, timezone

from schemas import Incident
from fixtures import IKEJA_FIXTURES


class IncidentImpactBuilder:
    """
    Builds the load-bearing Incident object for the Ikeja scenario.
    All 6 demo numbers come directly from IKEJA_FIXTURES — never computed.
    """

    def __init__(self, fixtures: dict = IKEJA_FIXTURES) -> None:
        self._f = fixtures

    def build(self, incident_id: str) -> Incident:
        now = datetime.now(timezone.utc)
        return Incident(
            incident_id               = incident_id,
            lga_id                    = self._f["lga_id"],
            cause                     = self._f["cause"],
            phase                     = "active",
            subscribers_affected      = self._f["subscribers_affected"],
            enterprise_lines_affected = self._f["enterprise_lines_affected"],
            revenue_at_risk_ngn       = self._f["revenue_at_risk_ngn"],
            compensation_exposure_ngn = self._f["compensation_exposure_ngn"],
            peak_score                = self._f["peak_score"],
            current_score             = self._f["peak_score"],
            time_to_breach_minutes    = self._f["time_to_breach_minutes"],
            started_at                = now,
            updated_at                = now,
            signal_evidence_ids       = self._f["bts_sites"],
        )
