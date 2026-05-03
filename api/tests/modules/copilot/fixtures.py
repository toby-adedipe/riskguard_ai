from __future__ import annotations

from app.modules.audit.db import AuditLogRepository
from app.modules.compliance.db import CompliancePackRepository
from app.modules.copilot.db import InvestigationRunRepository
from app.modules.copilot.orchestrator import MainInvestigationAgent
from app.modules.copilot.services import DemoCopilotToolBackend
from app.modules.copilot.tool_registry import ToolRegistry
from app.modules.copilot.validation import ClaimValidator
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository


def build_seeded_agent() -> tuple[MainInvestigationAgent, InvestigationRunRepository]:
    risk_repo = RiskScoreRepository()
    incident_repo = IncidentRepository()
    audit_repo = AuditLogRepository()
    compliance_repo = CompliancePackRepository()
    run_repo = InvestigationRunRepository()

    backend = DemoCopilotToolBackend(
        risk_repo=risk_repo,
        incident_repo=incident_repo,
        audit_repo=audit_repo,
        compliance_repo=compliance_repo,
    )
    agent = MainInvestigationAgent(
        registry=ToolRegistry(backend),
        validator=ClaimValidator(),
        runs=run_repo,
    )
    return agent, run_repo
