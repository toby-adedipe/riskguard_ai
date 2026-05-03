from datetime import datetime, timezone
from typing import cast
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.schemas import InvestigationTrigger, Operator, OperatorRole
from app.modules.audit.db import AuditLogRepository, get_audit_repo
from app.modules.compliance.db import CompliancePackRepository, get_compliance_repo
from app.modules.copilot.db import InvestigationRunRepository, get_investigation_run_repo
from app.modules.copilot.harness import HarnessRunReport
from app.modules.copilot.schemas import (
    CopilotFollowUpRequest,
    CopilotFollowUpResponse,
    CopilotInvestigateRequest,
    CopilotQueryRequest,
    CopilotQueryResponse,
)
from app.modules.copilot.services import CopilotService
from app.modules.incidents.db import IncidentRepository, get_incident_repo
from app.modules.risk.db import RiskScoreRepository, get_risk_repo

router = APIRouter(prefix="/copilot", tags=["copilot"])


def get_service(
    risk_repo: RiskScoreRepository = Depends(get_risk_repo),
    incident_repo: IncidentRepository = Depends(get_incident_repo),
    audit_repo: AuditLogRepository = Depends(get_audit_repo),
    compliance_repo: CompliancePackRepository = Depends(get_compliance_repo),
    run_repo: InvestigationRunRepository = Depends(get_investigation_run_repo),
) -> CopilotService:
    return CopilotService(
        risk_repo=risk_repo,
        incident_repo=incident_repo,
        audit_repo=audit_repo,
        compliance_repo=compliance_repo,
        run_repo=run_repo,
    )


def get_current_operator(
    x_operator_role: str | None = Header(default=None),
) -> Operator:
    role = x_operator_role or "admin"
    allowed_roles = {"admin", "network_ops", "revenue_assurance", "cx_ops", "compliance_officer"}
    if role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Unsupported operator role.")
    return Operator(
        operator_id="demo-operator-001",
        name="Demo Operator",
        role=cast(OperatorRole, role),
    )


def require_operator_access(operator: Operator, capability: str) -> None:
    access_by_role: dict[OperatorRole, set[str]] = {
        "admin": {"*"},
        "network_ops": {"network_risk", "mitigation", "investigate", "reports", "follow_up"},
        "revenue_assurance": {"revenue_assurance", "reports", "follow_up"},
        "cx_ops": {"customer_experience", "reports", "follow_up"},
        "compliance_officer": {"compliance", "reports", "follow_up"},
    }
    allowed = access_by_role[operator.role]
    if "*" in allowed or capability in allowed:
        return
    raise HTTPException(status_code=403, detail="Operator role cannot access this copilot capability.")


@router.post("/query", response_model=CopilotQueryResponse)
def query(
    request: CopilotQueryRequest,
    service: CopilotService = Depends(get_service),
    operator: Operator = Depends(get_current_operator),
) -> CopilotQueryResponse:
    require_operator_access(operator, request.role)
    return service.query(request)


@router.post("/investigate", response_model=HarnessRunReport)
def investigate(
    request: CopilotInvestigateRequest,
    service: CopilotService = Depends(get_service),
    operator: Operator = Depends(get_current_operator),
) -> HarnessRunReport:
    require_operator_access(operator, "investigate")
    trigger = InvestigationTrigger(
        trigger_id=str(uuid4()),
        lga_id=request.lga_id,
        incident_id=request.incident_id,
        trigger_type="threshold",
        score=request.score,
        confidence=request.confidence,
        time_to_breach_minutes=request.time_to_breach_minutes,
        triggered_domains=request.triggered_domains,
        reason=request.reason,
        created_at=datetime.now(timezone.utc),
    )
    return service.investigate(trigger)


@router.get("/investigations/{harness_run_id}", response_model=HarnessRunReport)
def get_investigation(
    harness_run_id: str,
    service: CopilotService = Depends(get_service),
    operator: Operator = Depends(get_current_operator),
) -> HarnessRunReport:
    require_operator_access(operator, "reports")
    report = service.get_report(harness_run_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Investigation report not found.")
    return report


@router.get("/incidents/{incident_id}/investigations", response_model=list[HarnessRunReport])
def list_incident_investigations(
    incident_id: str,
    service: CopilotService = Depends(get_service),
    operator: Operator = Depends(get_current_operator),
) -> list[HarnessRunReport]:
    require_operator_access(operator, "reports")
    return service.list_reports_for_incident(incident_id)


@router.post(
    "/investigations/{harness_run_id}/follow-up",
    response_model=CopilotFollowUpResponse,
)
def follow_up(
    harness_run_id: str,
    request: CopilotFollowUpRequest,
    service: CopilotService = Depends(get_service),
    operator: Operator = Depends(get_current_operator),
) -> CopilotFollowUpResponse:
    require_operator_access(operator, "follow_up")
    response = service.follow_up(harness_run_id, request)
    if response is None:
        raise HTTPException(status_code=404, detail="Investigation report not found.")
    return response
