from datetime import datetime, timezone

from app.core.schemas import Incident, IncidentImpact, IncidentPhase, RiskScore
from app.demo_data.dataset import load_demo_scenario
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository
from app.modules.simulation.db import SimulationRepository
from app.modules.simulation.schemas import SimulationStatus


class SimulationService:
    """Presentation-fixture adapter retained while replay ingestion is built.

    This service must not be described as detection or autonomous analysis.
    """

    def __init__(
        self,
        repo: SimulationRepository,
        risk_repo: RiskScoreRepository,
        incident_repo: IncidentRepository,
    ) -> None:
        self._repo = repo
        self._risk_repo = risk_repo
        self._incident_repo = incident_repo
        self._scenario = load_demo_scenario()

    def start(self) -> SimulationStatus:
        self._set_baseline_state(clear_incidents=True)
        status = SimulationStatus(mode="baseline", incident_id=None)
        self._repo.set(status)
        return status

    def trigger_ikeja(self) -> SimulationStatus:
        incident_id = "INC-2026-IKEJA-001"
        scenario_incident = self._scenario.incident_by_id(incident_id)
        if scenario_incident is not None:
            self._incident_repo.upsert(
                scenario_incident.model_copy(
                    update={
                        "phase": "active",
                        "opened_at": datetime.now(timezone.utc),
                    }
                )
            )
        else:
            self._incident_repo.upsert(
                Incident(
                    incident_id=incident_id,
                    lga_id="ikeja",
                    cause="network outage",
                    phase="active",
                    opened_at=datetime.now(timezone.utc),
                    impact=IncidentImpact(
                        affected_subscribers=18420,
                        enterprise_lines=312,
                        revenue_at_risk_ngn=8_700_000.0,
                        compensation_exposure_ngn=2_100_000.0,
                        ncc_exposure_summary=(
                            "NCC exposure is elevated if service restoration slips "
                            "beyond the current 47-minute breach window."
                        ),
                    ),
                )
            )

        self._risk_repo.upsert(
            RiskScore(
                lga_id="ikeja",
                score=87.0,
                severity="red",
                confidence=0.91,
                time_to_breach_minutes=47,
                updated_at=datetime.now(timezone.utc),
            )
        )

        status = SimulationStatus(mode="incident", incident_id="INC-2026-IKEJA-001")
        self._repo.set(status)
        return status

    def reset(self) -> SimulationStatus:
        self._set_baseline_state(clear_incidents=True)
        status = SimulationStatus(mode="idle", incident_id=None)
        self._repo.set(status)
        return status

    def _set_baseline_state(self, clear_incidents: bool = True) -> None:
        now = datetime.now(timezone.utc)
        base_scores = {
            "ikeja": 12,
            "lekki": 8,
            "surulere": 15,
            "agege": 5,
            "alimosho": 20,
            "apapa": 18,
            "eti_osa": 10,
            "ikorodu": 7,
            "mushin": 14,
            "oshodi": 16,
        }
        for lga_id, score in base_scores.items():
            self._risk_repo.upsert(
                RiskScore(
                    lga_id=lga_id,
                    score=float(score),
                    severity="green",
                    confidence=0.81,
                    time_to_breach_minutes=None,
                    updated_at=now,
                )
            )

        if clear_incidents:
            self._incident_repo.clear()
