from fastapi import APIRouter, Body, Depends, Query

from app.engine.event_log import EventLog, get_event_log
from app.engine.live_trigger import start_live_trigger
from app.modules.audit.db import AuditLogRepository, get_audit_repo
from app.modules.compliance.db import CompliancePackRepository, get_compliance_repo
from app.modules.copilot.db import InvestigationRunRepository, get_investigation_run_repo
from app.modules.incidents.db import IncidentRepository, get_incident_repo
from app.modules.risk.db import RiskScoreRepository, get_risk_repo
from app.modules.simulation.db import SimulationRepository, get_simulation_repo
from app.modules.simulation.schemas import (
    SimulationCommandResponse,
    SimulationEventsResponse,
    SimulationStatus,
    SimulationTriggerRequest,
)
from app.modules.simulation.services import SimulationService

router = APIRouter(prefix="/simulation", tags=["simulation"])


def get_service(
    repo: SimulationRepository = Depends(get_simulation_repo),
    risk_repo: RiskScoreRepository = Depends(get_risk_repo),
    incident_repo: IncidentRepository = Depends(get_incident_repo),
) -> SimulationService:
    return SimulationService(repo, risk_repo, incident_repo)


@router.post("/start", response_model=SimulationCommandResponse)
def start(service: SimulationService = Depends(get_service)) -> SimulationCommandResponse:
    get_event_log().reset(session_id="")
    return SimulationCommandResponse(ok=True, status=service.start())


@router.post("/trigger/ikeja", response_model=SimulationCommandResponse)
def trigger_ikeja(
    request: SimulationTriggerRequest = Body(default_factory=SimulationTriggerRequest),
    repo: SimulationRepository = Depends(get_simulation_repo),
    risk_repo: RiskScoreRepository = Depends(get_risk_repo),
    incident_repo: IncidentRepository = Depends(get_incident_repo),
    audit_repo: AuditLogRepository = Depends(get_audit_repo),
    compliance_repo: CompliancePackRepository = Depends(get_compliance_repo),
    run_repo: InvestigationRunRepository = Depends(get_investigation_run_repo),
) -> SimulationCommandResponse:
    """Kicks off the live demo: progressive score climb + agent investigation.

    Returns immediately with a session_id; the frontend then polls
    /simulation/events to render the live timeline.
    """
    repo.set(SimulationStatus(mode="incident", incident_id="INC-2025-IKEJA-001"))
    session_id = start_live_trigger(
        risk_repo=risk_repo,
        incident_repo=incident_repo,
        audit_repo=audit_repo,
        compliance_repo=compliance_repo,
        run_repo=run_repo,
        event_log=get_event_log(),
        wake_threshold=request.agent_threshold,
    )
    return SimulationCommandResponse(
        ok=True,
        status=SimulationStatus(mode="incident", incident_id="INC-2025-IKEJA-001"),
        session_id=session_id,
    )


@router.post("/mitigate", response_model=SimulationCommandResponse)
def mitigate(service: SimulationService = Depends(get_service)) -> SimulationCommandResponse:
    return SimulationCommandResponse(ok=True, status=service.mitigate())


@router.post("/reset", response_model=SimulationCommandResponse)
def reset(service: SimulationService = Depends(get_service)) -> SimulationCommandResponse:
    get_event_log().reset(session_id="")
    return SimulationCommandResponse(ok=True, status=service.reset())


@router.get("/events", response_model=SimulationEventsResponse)
def list_events(
    since: int = Query(default=0, ge=0),
    session_id: str | None = Query(default=None),
    log: EventLog = Depends(get_event_log),
) -> SimulationEventsResponse:
    """Polled by the frontend to drive the live demo timeline."""
    current_session = log.session_id()
    # If the caller is asking about a stale session, return nothing so it can
    # detect the drift via session_id mismatch.
    if session_id is not None and current_session != session_id:
        return SimulationEventsResponse(
            session_id=current_session,
            events=[],
            last_event_id=since,
        )
    events = log.since(since)
    last_id = events[-1]["id"] if events else since
    return SimulationEventsResponse(
        session_id=current_session,
        events=events,
        last_event_id=last_id,
    )
