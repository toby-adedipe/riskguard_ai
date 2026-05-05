from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.core.schemas import AuditLogEntry, RiskScore
from app.demo_data.dataset import load_demo_scenario
from app.modules.actions.schemas import (
    ActionApproveRequest,
    ActionProjection,
    ActionSimulateRequest,
    ActionSimulateResponse,
)
from app.modules.audit.db import AuditLogRepository
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository
from app.modules.simulation.db import SimulationRepository
from app.modules.simulation.schemas import SimulationStatus


class ActionService:
    """Action APIs are driven by deterministic demo scenario data."""

    def __init__(
        self,
        *,
        audit_repo: AuditLogRepository,
        incident_repo: IncidentRepository,
        risk_repo: RiskScoreRepository,
        simulation_repo: SimulationRepository,
    ) -> None:
        self._audit_repo = audit_repo
        self._incident_repo = incident_repo
        self._risk_repo = risk_repo
        self._simulation_repo = simulation_repo
        self._scenario = load_demo_scenario()

    def simulate(self, request: ActionSimulateRequest) -> ActionSimulateResponse:
        simulation = self._scenario.simulation_for_incident(request.incident_id)
        if simulation is None:
            return ActionSimulateResponse(
                incident_id=request.incident_id,
                do_nothing_curve=[],
                actions=[],
            )

        selected_ids = set(request.action_ids or [])
        projections = simulation.actions if not selected_ids else [
            action
            for action in simulation.actions
            if action.action_id in selected_ids
        ]

        playbook = self._scenario.playbook_for_risk_type("network_outage")
        options = {option.action_id: option for option in (playbook.options if playbook else [])}

        return ActionSimulateResponse(
            incident_id=request.incident_id,
            do_nothing_curve=simulation.do_nothing_curve,
            actions=[
                ActionProjection(
                    action_id=projection.action_id,
                    name=options.get(projection.action_id).name
                    if projection.action_id in options
                    else projection.action_id,
                    description=options.get(projection.action_id).description
                    if projection.action_id in options
                    else "Mitigation action from playbook simulation.",
                    risk_reduction=self._resolve_risk_reduction(
                        projection.action_id,
                        projection,
                        options.get(projection.action_id),
                    ),
                    projected_score_curve=projection.projected_score_curve,
                    confidence=projection.confidence,
                    time_to_effect_minutes=projection.time_to_effect_minutes,
                )
                for projection in projections
            ],
        )

    def approve(self, request: ActionApproveRequest) -> AuditLogEntry:
        incident_id = self._resolve_incident_id(request.incident_id)
        if incident_id is None:
            incident_id = ""

        if incident_id:
            incident = self._incident_repo.get(incident_id)
            if incident is not None:
                self._incident_repo.set_phase(incident_id, "mitigating")
                self._risk_repo.upsert(
                    RiskScore(
                        lga_id=incident.lga_id,
                        score=self._target_mitigated_risk(incident_id, request.action_id),
                        severity="amber",
                        confidence=0.93,
                        time_to_breach_minutes=125,
                        updated_at=datetime.now(timezone.utc),
                    )
                )

        if incident_id:
            self._simulation_repo.set(
                SimulationStatus(mode="mitigating", incident_id=incident_id),
            )

        entry = AuditLogEntry(
            entry_id=str(uuid4()),
            incident_id=incident_id,
            operator=request.operator,
            action_id=request.action_id,
            expected_impact=request.expected_impact or "",
            rationale=request.rationale or "",
            timestamp=datetime.now(timezone.utc),
        )
        self._audit_repo.append(entry)
        return entry

    def _resolve_risk_reduction(
        self,
        action_id: str,
        projection: ActionProjection,
        option,
    ) -> float:
        if option is not None and option.expected_risk_delta is not None:
            return float(option.expected_risk_delta)
        if projection.projected_score_curve:
            start = projection.projected_score_curve[0]
            projected_end = projection.projected_score_curve[-1]
            if projection.time_to_effect_minutes <= 0:
                return 0.0
            return max(0.0, float(start - projected_end))
        return 0.0

    def _target_mitigated_risk(self, incident_id: str, action_id: str) -> float:
        simulation = self._scenario.simulation_for_incident(incident_id)
        if simulation is not None:
            projection = next(
                (item for item in simulation.actions if item.action_id == action_id),
                None,
            )
            if projection is not None and projection.projected_score_curve:
                return float(projection.projected_score_curve[-1])

        incident = self._incident_repo.get(incident_id)
        if incident is None:
            return 42.0
        current = self._risk_repo.get(incident.lga_id)
        if current is None:
            return 42.0
        return max(0.0, float(current.score) - 45.0)

    def _resolve_incident_id(self, incident_id: str | None) -> str | None:
        if incident_id:
            return incident_id
        status = self._simulation_repo.get()
        return status.incident_id
