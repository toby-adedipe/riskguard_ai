from datetime import datetime, timezone
from threading import Thread, Event
import time
from app.core.schemas import Incident, IncidentImpact, RiskScore
from app.engine.repos import DictIncidentRepo, DictRiskScoreRepo, DictSignalEventRepo
from app.engine.recovery import RecoveryModel


class SyntheticEventGenerator:
    def __init__(self, normalizer, sig_repo: DictSignalEventRepo, score_repo: DictRiskScoreRepo, inc_repo: DictIncidentRepo) -> None:
        self._normalizer = normalizer
        self._sig_repo = sig_repo
        self._score_repo = score_repo
        self._inc_repo = inc_repo
        self._recovery_thread: Thread | None = None
        self._stop_event = Event()

    def start(self) -> None:
        # Seed baseline score
        baseline = RiskScore(lga_id="IKEJA", score=20.0, severity="green", confidence=0.5, time_to_breach_minutes=None, updated_at=datetime.now(timezone.utc))
        self._score_repo.upsert(baseline)

    def trigger_ikeja(self) -> None:
        # Create deterministic incident and peak score
        impact = IncidentImpact(affected_subscribers=18420, enterprise_lines=312, revenue_at_risk_ngn=8700000.0, compensation_exposure_ngn=2100000.0, ncc_exposure_summary="Potential service outage")
        incident = Incident(incident_id="INC-2025-IKEJA-001", lga_id="IKEJA", cause="Synthetic Ikeja incident", phase="active", opened_at=datetime.now(timezone.utc), impact=impact)
        self._inc_repo.upsert(incident)
        peak = RiskScore(lga_id="IKEJA", score=87.0, severity="red", confidence=0.99, time_to_breach_minutes=47, updated_at=datetime.now(timezone.utc))
        self._score_repo.upsert(peak)

    def enter_recovery(self) -> None:
        # Start background thread to tick recovery and update repo
        incs = list(self._inc_repo._incidents.values())
        if not incs:
            return
        incident_id = incs[0].incident_id
        model = RecoveryModel(incident_id)

        def run():
            while not model.is_complete() and not self._stop_event.is_set():
                score = model.tick()
                self._score_repo.upsert(score)
                self._inc_repo.set_phase(incident_id, "recovery")
                time.sleep(5)

        self._recovery_thread = Thread(target=run, daemon=True)
        self._recovery_thread.start()

    def reset(self) -> None:
        # Clear incidents and reset baseline
        self._stop_event.set()
        baseline = RiskScore(lga_id="IKEJA", score=20.0, severity="green", confidence=0.5, time_to_breach_minutes=None, updated_at=datetime.now(timezone.utc))
        self._score_repo.upsert(baseline)
        # Remove incidents
        self._inc_repo._incidents.clear()
