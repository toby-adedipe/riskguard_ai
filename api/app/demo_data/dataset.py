from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.core.schemas import (
    AuditLogEntry,
    FeatureWindow,
    Incident,
    MitigationPlaybook,
    RiskScore,
    SignalEvidence,
    SignalEvent,
)
from app.modules.actions.schemas import ActionSimulateResponse
from app.modules.audit.db import AuditLogRepository
from app.modules.compliance.schemas import NCCPack
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository


FIXTURE_PATH = Path(__file__).with_name("ikeja_outage_fixture.json")


class DemoScenario(BaseModel):
    signal_events: list[SignalEvent] = Field(default_factory=list)
    feature_windows: list[FeatureWindow] = Field(default_factory=list)
    signal_evidence: list[SignalEvidence] = Field(default_factory=list)
    risk_scores: list[RiskScore] = Field(default_factory=list)
    incidents: list[Incident] = Field(default_factory=list)
    mitigation_playbooks: list[MitigationPlaybook] = Field(default_factory=list)
    action_simulations: list[ActionSimulateResponse] = Field(default_factory=list)
    audit_log_entries: list[AuditLogEntry] = Field(default_factory=list)
    ncc_packs: list[NCCPack] = Field(default_factory=list)

    def risk_score_for_lga(self, lga_id: str) -> RiskScore | None:
        return next((score for score in self.risk_scores if score.lga_id == lga_id), None)

    def incident_by_id(self, incident_id: str) -> Incident | None:
        return next((incident for incident in self.incidents if incident.incident_id == incident_id), None)

    def incident_by_lga(self, lga_id: str) -> Incident | None:
        return next((incident for incident in self.incidents if incident.lga_id == lga_id), None)

    def playbook_for_risk_type(self, risk_type: str) -> MitigationPlaybook | None:
        normalized = risk_type.strip().lower().replace(" ", "_")
        return next(
            (
                playbook
                for playbook in self.mitigation_playbooks
                if playbook.risk_type.strip().lower().replace(" ", "_") == normalized
            ),
            None,
        )

    def simulation_for_incident(self, incident_id: str) -> ActionSimulateResponse | None:
        return next(
            (
                simulation
                for simulation in self.action_simulations
                if simulation.incident_id == incident_id
            ),
            None,
        )

    def ncc_pack_for_incident(self, incident_id: str) -> NCCPack | None:
        return next(
            (
                pack
                for pack in self.ncc_packs
                if pack.incident.incident_id == incident_id
            ),
            None,
        )


@lru_cache
def load_demo_scenario() -> DemoScenario:
    with FIXTURE_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return _with_social_media_signals(DemoScenario.model_validate(payload))


def _with_social_media_signals(scenario: DemoScenario) -> DemoScenario:
    evidence_id = "evd:ikeja:social_media:negative_sentiment"
    if any(evidence.evidence_id == evidence_id for evidence in scenario.signal_evidence):
        return scenario

    now = datetime(2026, 5, 5, 14, 16, tzinfo=timezone.utc)
    event = SignalEvent(
        event_id="evt-ikeja-social-media-001",
        lga_id="ikeja",
        domain="social_media",
        kpi="social_posts_per_hr",
        value=186.0,
        unit="posts/hr",
        source_system="social_media_listening",
        baseline_value=14.0,
        delta_pct=1228.57,
        threshold_value=40.0,
        anomaly_score=0.89,
        severity_hint="high",
        sample_window_minutes=15,
        correlation_key="ikeja-network-outage-social",
        evidence_id=evidence_id,
        timestamp=now,
    )
    window = FeatureWindow(
        lga_id="ikeja",
        domain="social_media",
        kpi="social_posts_per_hr",
        window_minutes=15,
        current_value=186.0,
        rolling_mean=14.0,
        rolling_stddev=35.1,
        z_score=4.9,
        delta_pct=1228.57,
        anomaly_score=0.89,
        sample_count=15,
        time_to_breach_minutes=47,
        evidence_ids=[evidence_id],
        updated_at=now,
    )
    evidence = SignalEvidence(
        evidence_id=evidence_id,
        lga_id="ikeja",
        incident_id="INC-2025-IKEJA-001",
        domain="social_media",
        kpi="social_posts_per_hr",
        current_value=186.0,
        baseline_value=14.0,
        delta_pct=1228.57,
        anomaly_score=0.89,
        severity_hint="high",
        summary=(
            "Social listening detected 186 Ikeja outage posts per hour versus a "
            "14-post baseline, with negative sentiment concentrated around failed "
            "data sessions and enterprise connectivity."
        ),
        source_system="social_media_listening",
        timestamp=now,
        related_event_ids=[event.event_id],
    )
    return scenario.model_copy(
        update={
            "signal_events": scenario.signal_events + [event],
            "feature_windows": scenario.feature_windows + [window],
            "signal_evidence": scenario.signal_evidence + [evidence],
        }
    )


def seed_demo_state(
    risk_repo: RiskScoreRepository,
    incident_repo: IncidentRepository,
    audit_repo: AuditLogRepository,
) -> DemoScenario:
    scenario = load_demo_scenario()

    for risk_score in scenario.risk_scores:
        risk_repo.upsert(risk_score)

    for incident in scenario.incidents:
        incident_repo.upsert(incident)

    existing_ids = {entry.entry_id for entry in audit_repo.all()}
    for entry in scenario.audit_log_entries:
        if entry.entry_id not in existing_ids:
            audit_repo.append(entry)

    return scenario
