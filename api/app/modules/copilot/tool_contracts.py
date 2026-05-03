from __future__ import annotations

from typing import Literal, Protocol, runtime_checkable

from app.core.schemas import (
    AuditLogEntry,
    FeatureWindow,
    Incident,
    MitigationPlaybook,
    RiskScore,
    SignalDomain,
    SignalEvidence,
)
from app.modules.actions.schemas import ActionSimulateResponse
from app.modules.compliance.schemas import NCCPack


ToolName = Literal[
    "get_risk_snapshot",
    "get_incident_context",
    "get_signal_evidence",
    "get_feature_windows",
    "estimate_impact",
    "get_mitigation_playbook",
    "run_pre_action_simulation",
    "get_audit_trail",
    "generate_ncc_pack_draft",
    "validate_claims_against_context",
    "write_investigation_note",
]


ROLE_ALLOWED_TOOLS: dict[str, tuple[ToolName, ...]] = {
    "investigation_harness": (
        "get_risk_snapshot",
        "get_incident_context",
        "get_signal_evidence",
        "get_feature_windows",
        "get_mitigation_playbook",
        "run_pre_action_simulation",
        "get_audit_trail",
        "generate_ncc_pack_draft",
    ),
    "network_risk": (
        "get_risk_snapshot",
        "get_incident_context",
        "get_signal_evidence",
        "get_feature_windows",
    ),
    "revenue_assurance": (
        "get_incident_context",
        "get_signal_evidence",
        "estimate_impact",
    ),
    "customer_experience": (
        "get_incident_context",
        "get_signal_evidence",
        "estimate_impact",
    ),
    "mitigation": (
        "get_incident_context",
        "get_mitigation_playbook",
        "run_pre_action_simulation",
        "write_investigation_note",
    ),
    "compliance": (
        "get_incident_context",
        "estimate_impact",
        "get_audit_trail",
        "generate_ncc_pack_draft",
        "validate_claims_against_context",
    ),
}


@runtime_checkable
class CopilotToolBackend(Protocol):
    def get_risk_snapshot(self, lga_id: str) -> RiskScore | None: ...

    def get_incident_context(
        self,
        *,
        lga_id: str | None = None,
        incident_id: str | None = None,
    ) -> Incident | None: ...

    def get_signal_evidence(
        self,
        lga_id: str,
        domains: list[SignalDomain],
        limit: int = 10,
    ) -> list[SignalEvidence]: ...

    def get_feature_windows(
        self,
        lga_id: str,
        domains: list[SignalDomain],
    ) -> list[FeatureWindow]: ...

    def estimate_impact(self, incident_id: str) -> dict[str, object]: ...

    def get_mitigation_playbook(self, risk_type: str) -> MitigationPlaybook: ...

    def run_pre_action_simulation(
        self,
        incident_id: str,
        action_ids: list[str],
    ) -> ActionSimulateResponse: ...

    def get_audit_trail(self, incident_id: str) -> list[AuditLogEntry]: ...

    def generate_ncc_pack_draft(self, incident_id: str) -> NCCPack | None: ...

    def validate_claims_against_context(
        self,
        text: str,
        context_id: str,
    ) -> dict[str, object]: ...

    def write_investigation_note(
        self,
        incident_id: str,
        agent_role: str,
        summary: str,
        evidence_ids: list[str],
    ) -> dict[str, object]: ...
