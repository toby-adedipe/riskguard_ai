from fastapi import APIRouter, Depends, HTTPException

from app.modules.audit.db import AuditLogRepository, get_audit_repo
from app.modules.compliance.db import CompliancePackRepository, get_compliance_repo
from app.modules.compliance.schemas import NCCPack
from app.modules.compliance.services import ComplianceService
from app.modules.incidents.db import IncidentRepository, get_incident_repo
from app.modules.risk.db import RiskScoreRepository, get_risk_repo

router = APIRouter(prefix="/compliance", tags=["compliance"])


def get_service(
    incidents: IncidentRepository = Depends(get_incident_repo),
    audit: AuditLogRepository = Depends(get_audit_repo),
    packs: CompliancePackRepository = Depends(get_compliance_repo),
    risks: RiskScoreRepository = Depends(get_risk_repo),
) -> ComplianceService:
    return ComplianceService(incidents, audit, packs, risks)


@router.get("/pack/{incident_id}", response_model=NCCPack)
def get_pack(
    incident_id: str,
    service: ComplianceService = Depends(get_service),
) -> NCCPack:
    pack = service.build_pack(incident_id)
    if pack is None:
        raise HTTPException(status_code=404, detail="incident not found")
    return pack
