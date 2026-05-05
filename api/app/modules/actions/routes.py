from fastapi import APIRouter, Depends

from app.modules.actions.schemas import (
    ActionApproveRequest,
    ActionApproveResponse,
    ActionSimulateRequest,
    ActionSimulateResponse,
)
from app.modules.incidents.db import IncidentRepository, get_incident_repo
from app.modules.actions.services import ActionService
from app.modules.risk.db import RiskScoreRepository, get_risk_repo
from app.modules.audit.db import AuditLogRepository, get_audit_repo
from app.modules.simulation.db import SimulationRepository, get_simulation_repo

router = APIRouter(prefix="/actions", tags=["actions"])


def get_service(
    audit_repo: AuditLogRepository = Depends(get_audit_repo),
    incident_repo: IncidentRepository = Depends(get_incident_repo),
    risk_repo: RiskScoreRepository = Depends(get_risk_repo),
    simulation_repo: SimulationRepository = Depends(get_simulation_repo),
) -> ActionService:
    return ActionService(
        audit_repo=audit_repo,
        incident_repo=incident_repo,
        risk_repo=risk_repo,
        simulation_repo=simulation_repo,
    )


@router.post("/simulate", response_model=ActionSimulateResponse)
def simulate(
    request: ActionSimulateRequest,
    service: ActionService = Depends(get_service),
) -> ActionSimulateResponse:
    return service.simulate(request)


@router.post("/approve", response_model=ActionApproveResponse)
def approve(
    request: ActionApproveRequest,
    service: ActionService = Depends(get_service),
) -> ActionApproveResponse:
    entry = service.approve(request)
    return ActionApproveResponse(ok=True, audit_entry=entry)
