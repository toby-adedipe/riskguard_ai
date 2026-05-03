from fastapi import APIRouter, Depends

from app.modules.audit.db import AuditLogRepository, get_audit_repo
from app.modules.compliance.db import CompliancePackRepository, get_compliance_repo
from app.modules.copilot.db import InvestigationRunRepository, get_investigation_run_repo
from app.modules.copilot.schemas import CopilotQueryRequest, CopilotQueryResponse
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


@router.post("/query", response_model=CopilotQueryResponse)
def query(
    request: CopilotQueryRequest,
    service: CopilotService = Depends(get_service),
) -> CopilotQueryResponse:
    return service.query(request)
