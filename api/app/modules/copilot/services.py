from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.core.config import get_settings
from app.demo_data.dataset import seed_demo_state
from app.core.schemas import (
    RiskScore,
    SignalEvidence,
)
from app.modules.actions.schemas import ActionProjection, ActionSimulateResponse
from app.modules.audit.db import AuditLogRepository
from app.modules.compliance.db import CompliancePackRepository
from app.modules.compliance.services import ComplianceService
from app.modules.copilot.db import InvestigationRunRepository
from app.modules.copilot.orchestrator import MainInvestigationAgent
from app.modules.copilot.semantic_runtime import SemanticKernelRoleRunner
from app.modules.copilot.schemas import CopilotQueryRequest
from app.modules.copilot.tool_registry import ToolRegistry
from app.modules.copilot.validation import ClaimValidator
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository


class DemoCopilotToolBackend:
    """Repo-backed demo tool layer used by the SK agents during MVP development."""

    def __init__(
        self,
        risk_repo: RiskScoreRepository,
        incident_repo: IncidentRepository,
        audit_repo: AuditLogRepository,
        compliance_repo: CompliancePackRepository,
    ) -> None:
        self._risk_repo = risk_repo
        self._incident_repo = incident_repo
        self._audit_repo = audit_repo
        self._scenario = seed_demo_state(risk_repo, incident_repo, audit_repo)
        self._compliance = ComplianceService(
            incidents=incident_repo,
            audit=audit_repo,
            packs=compliance_repo,
        )

    def get_risk_snapshot(self, lga_id: str) -> RiskScore | None:
        return self._risk_repo.get(lga_id)

    def get_incident_context(
        self,
        *,
        lga_id: str | None = None,
        incident_id: str | None = None,
    ):
        if incident_id is not None:
            incident = self._incident_repo.get(incident_id)
            if incident is not None:
                return incident
            return self._scenario.incident_by_id(incident_id)
        if lga_id is not None:
            return self._scenario.incident_by_lga(lga_id)
        return None

    def get_signal_evidence(
        self,
        lga_id: str,
        domains: list[str],
        limit: int = 10,
    ) -> list[SignalEvidence]:
        domain_set = set(domains)
        evidence = [
            item
            for item in self._scenario.signal_evidence
            if item.lga_id == lga_id and item.domain in domain_set
        ]
        return evidence[:limit]

    def get_feature_windows(self, lga_id: str, domains: list[str]):
        domain_set = set(domains)
        return [
            item
            for item in self._scenario.feature_windows
            if item.lga_id == lga_id and item.domain in domain_set
        ]

    def estimate_impact(self, incident_id: str) -> dict[str, object]:
        incident = self._incident_repo.get(incident_id)
        if incident is None:
            return {}
        return incident.impact.model_dump()

    def get_mitigation_playbook(self, risk_type: str):
        playbook = self._scenario.playbook_for_risk_type(risk_type)
        if playbook is None:
            incident = self._scenario.incidents[0] if self._scenario.incidents else None
            if incident is not None:
                playbook = self._scenario.playbook_for_risk_type(incident.cause)
        if playbook is None and self._scenario.mitigation_playbooks:
            playbook = self._scenario.mitigation_playbooks[0]
        if playbook is None:
            raise ValueError(f"No mitigation playbook found for risk type '{risk_type}'.")
        return playbook

    def run_pre_action_simulation(
        self,
        incident_id: str,
        action_ids: list[str],
    ) -> ActionSimulateResponse:
        simulation = self._scenario.simulation_for_incident(incident_id)
        if simulation is None:
            raise ValueError(f"No action simulation found for incident '{incident_id}'.")
        action_set = set(action_ids)
        return ActionSimulateResponse(
            incident_id=incident_id,
            do_nothing_curve=simulation.do_nothing_curve,
            actions=[
                ActionProjection.model_validate(action.model_dump())
                for action in simulation.actions
                if action.action_id in action_set
            ],
        )

    def get_audit_trail(self, incident_id: str):
        return self._audit_repo.for_incident(incident_id)

    def generate_ncc_pack_draft(self, incident_id: str):
        pack = self._scenario.ncc_pack_for_incident(incident_id)
        if pack is None:
            return self._compliance.build_pack(incident_id)
        return pack.model_copy(
            update={"approval_history": self._audit_repo.for_incident(incident_id)}
        )

    def validate_claims_against_context(self, text: str, context_id: str) -> dict[str, object]:
        return {
            "status": "passed",
            "unsupported_claims": [],
            "revised_text": text,
            "evidence_ids": [context_id],
        }

    def write_investigation_note(
        self,
        incident_id: str,
        agent_role: str,
        summary: str,
        evidence_ids: list[str],
    ) -> dict[str, object]:
        return {
            "note_id": f"note:{incident_id}:{agent_role}:{uuid4()}",
            "incident_id": incident_id,
            "agent_role": agent_role,
            "summary": summary,
            "evidence_ids": evidence_ids,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }


class CopilotService:
    def __init__(
        self,
        *,
        risk_repo: RiskScoreRepository,
        incident_repo: IncidentRepository,
        audit_repo: AuditLogRepository,
        compliance_repo: CompliancePackRepository,
        run_repo: InvestigationRunRepository,
    ) -> None:
        backend = DemoCopilotToolBackend(
            risk_repo=risk_repo,
            incident_repo=incident_repo,
            audit_repo=audit_repo,
            compliance_repo=compliance_repo,
        )
        settings = get_settings()
        role_runner = (
            SemanticKernelRoleRunner(settings=settings)
            if settings.azure_openai_configured
            else None
        )
        self._agent = MainInvestigationAgent(
            registry=ToolRegistry(backend),
            validator=ClaimValidator(),
            runs=run_repo,
            role_runner=role_runner,
        )

    def query(self, request: CopilotQueryRequest):
        return self._agent.query_role(request)

    def investigate(self, trigger):
        return self._agent.run_harness(trigger)

    def close(self) -> None:
        role_runner = getattr(self._agent, "_role_runner", None)
        if role_runner is not None and hasattr(role_runner, "close"):
            role_runner.close()
