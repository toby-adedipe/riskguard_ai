from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

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
    return DemoScenario.model_validate(payload)


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
