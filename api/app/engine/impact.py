from datetime import datetime, timezone
from app.core.schemas import Incident, IncidentImpact


class IncidentImpactBuilder:
    def build(self, incident_id: str) -> Incident | None:
        # Return a deterministic Incident matching demo numbers
        impact = IncidentImpact(
            affected_subscribers=18420,
            enterprise_lines=312,
            revenue_at_risk_ngn=8700000.0,
            compensation_exposure_ngn=2100000.0,
            ncc_exposure_summary="Potential service outage affecting subscribers",
        )
        return Incident(
            incident_id=incident_id,
            lga_id="IKEJA",
            cause="Synthetic Ikeja incident",
            phase="active",
            opened_at=datetime.now(timezone.utc),
            impact=impact,
        )
