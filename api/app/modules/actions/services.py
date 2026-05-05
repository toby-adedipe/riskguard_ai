from datetime import datetime, timezone
from uuid import uuid4

from app.core.schemas import AuditLogEntry
from app.modules.actions.schemas import (
    ActionApproveRequest,
    ActionProjection,
    ActionSimulateRequest,
    ActionSimulateResponse,
)
from app.modules.audit.db import AuditLogRepository
from app.engine.simulation import run_pre_action_simulation
from app.engine import runtime


class ActionService:
    def __init__(self, audit_repo: AuditLogRepository) -> None:
        self._audit_repo = audit_repo

    def simulate(self, request: ActionSimulateRequest) -> ActionSimulateResponse:
        result = run_pre_action_simulation(request.incident_id, request.action_ids)
        return ActionSimulateResponse(
            incident_id=result["incident_id"],
            do_nothing_curve=result.get("do_nothing_curve", []),
            actions=[
                ActionProjection(
                    action_id=a["action_id"],
                    projected_score_curve=a.get("projected_score_curve", []),
                    confidence=a.get("confidence", 0.0),
                    time_to_effect_minutes=a.get("time_to_effect_minutes", 0),
                )
                for a in result.get("actions", [])
            ],
        )

    def approve(self, request: ActionApproveRequest) -> AuditLogEntry:
        entry = AuditLogEntry(
            entry_id=str(uuid4()),
            incident_id=request.incident_id,
            operator=request.operator,
            action_id=request.action_id,
            expected_impact=request.expected_impact,
            rationale=request.rationale,
            timestamp=datetime.now(timezone.utc),
        )
        self._audit_repo.append(entry)
        # Trigger recovery via engine runtime
        try:
            runtime.generator.enter_recovery()
        except Exception:
            pass
        return entry
