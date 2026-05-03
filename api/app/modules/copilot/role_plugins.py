from __future__ import annotations

from dataclasses import dataclass

from app.core.schemas import (
    AgentFact,
    AgentInference,
    AgentRecommendation,
    AgentResponse,
    MitigationOption,
    SignalDomain,
)
from app.modules.copilot.tool_registry import ToolRegistry


@dataclass
class AgentExecutionContext:
    incident_id: str
    lga_id: str
    query: str


class BaseRolePlugin:
    role_name: str

    def run(self, context: AgentExecutionContext, registry: ToolRegistry) -> AgentResponse:
        raise NotImplementedError


class NetworkRiskSubAgent(BaseRolePlugin):
    role_name = "network_risk"

    def run(self, context: AgentExecutionContext, registry: ToolRegistry) -> AgentResponse:
        incident = registry.call(
            self.role_name,
            "get_incident_context",
            incident_id=context.incident_id,
        )
        risk = registry.call(self.role_name, "get_risk_snapshot", context.lga_id)
        evidence = registry.call(
            self.role_name,
            "get_signal_evidence",
            context.lga_id,
            ["network", "bts", "complaints"],
            3,
        )
        evidence_ids = {item.evidence_id for item in evidence}
        facts = [
            AgentFact(claim=item.summary, evidence_id=item.evidence_id)
            for item in evidence
        ]
        inferences = []
        if risk is not None:
            inferences.append(
                AgentInference(
                    claim=(
                        f"Risk in {context.lga_id} is elevated at {risk.score:.1f}"
                        f" with confidence {risk.confidence:.2f}."
                    ),
                    confidence=risk.confidence,
                )
            )
        if incident is not None:
            inferences.append(
                AgentInference(
                    claim=f"The active incident cause is currently tracked as {incident.cause}.",
                    confidence=0.8,
                )
            )
        return AgentResponse(
            agent_role=self.role_name,
            incident_id=context.incident_id,
            facts=facts,
            inferences=inferences,
            recommendations=[],
            tools_called=[
                "get_incident_context",
                "get_risk_snapshot",
                "get_signal_evidence",
            ],
            known_evidence_ids=sorted(evidence_ids),
        )


class RevenueRiskSubAgent(BaseRolePlugin):
    role_name = "revenue_assurance"

    def run(self, context: AgentExecutionContext, registry: ToolRegistry) -> AgentResponse:
        incident = registry.call(
            self.role_name,
            "get_incident_context",
            incident_id=context.incident_id,
        )
        impact = registry.call(self.role_name, "estimate_impact", context.incident_id)
        evidence = registry.call(
            self.role_name,
            "get_signal_evidence",
            context.lga_id,
            ["billing", "sales", "recharge"],
            3,
        )
        evidence_ids = {item.evidence_id for item in evidence}
        facts = [
            AgentFact(claim=item.summary, evidence_id=item.evidence_id)
            for item in evidence
        ]
        inferences = []
        if incident is not None:
            inferences.append(
                AgentInference(
                    claim=f"Revenue exposure is tied to the active {incident.phase} incident state.",
                    confidence=0.77,
                )
            )
        revenue_at_risk = impact.get("revenue_at_risk_ngn")
        if isinstance(revenue_at_risk, (int, float)):
            inferences.append(
                AgentInference(
                    claim=f"Revenue at risk is currently NGN {revenue_at_risk:,.0f}.",
                    confidence=0.86,
                )
            )
        return AgentResponse(
            agent_role=self.role_name,
            incident_id=context.incident_id,
            facts=facts,
            inferences=inferences,
            recommendations=[],
            tools_called=[
                "get_incident_context",
                "estimate_impact",
                "get_signal_evidence",
            ],
            known_evidence_ids=sorted(evidence_ids),
        )


class CustomerImpactSubAgent(BaseRolePlugin):
    role_name = "customer_experience"

    def run(self, context: AgentExecutionContext, registry: ToolRegistry) -> AgentResponse:
        impact = registry.call(self.role_name, "estimate_impact", context.incident_id)
        evidence = registry.call(
            self.role_name,
            "get_signal_evidence",
            context.lga_id,
            ["complaints", "device_sessions"],
            3,
        )
        evidence_ids = {item.evidence_id for item in evidence}
        facts = [
            AgentFact(claim=item.summary, evidence_id=item.evidence_id)
            for item in evidence
        ]
        affected_subscribers = impact.get("affected_subscribers")
        inferences = []
        if isinstance(affected_subscribers, int):
            inferences.append(
                AgentInference(
                    claim=f"{affected_subscribers} subscribers are currently affected.",
                    confidence=0.9,
                )
            )
        return AgentResponse(
            agent_role=self.role_name,
            incident_id=context.incident_id,
            facts=facts,
            inferences=inferences,
            recommendations=[],
            tools_called=["estimate_impact", "get_signal_evidence"],
            known_evidence_ids=sorted(evidence_ids),
        )


class MitigationSubAgent(BaseRolePlugin):
    role_name = "mitigation"

    def run(self, context: AgentExecutionContext, registry: ToolRegistry) -> AgentResponse:
        incident = registry.call(
            self.role_name,
            "get_incident_context",
            incident_id=context.incident_id,
        )
        risk_type = (incident.cause if incident else "network_outage").replace(" ", "_")
        playbook = registry.call(self.role_name, "get_mitigation_playbook", risk_type)
        action_ids = [option.action_id for option in playbook.options[:2]]
        allowed_action_ids = {option.action_id for option in playbook.options}
        simulation = registry.call(
            self.role_name,
            "run_pre_action_simulation",
            context.incident_id,
            action_ids,
        )
        best_option = self._pick_best_option(playbook.options, simulation.actions)
        note = None
        if best_option is not None:
            note = registry.call(
                self.role_name,
                "write_investigation_note",
                context.incident_id,
                self.role_name,
                f"Recommended {best_option.name} based on projected risk reduction.",
                [],
            )
        recommendations = []
        if best_option is not None:
            recommendations.append(
                AgentRecommendation(
                    action=best_option.action_id,
                    requires_approval=True,
                )
            )
        facts = []
        if note is not None:
            facts.append(
                AgentFact(
                    claim=f"Mitigation note recorded for {best_option.name if best_option else 'selected action'}.",
                    evidence_id=note["note_id"],
                )
            )
        evidence_ids = {fact.evidence_id for fact in facts}
        inferences = []
        if best_option is not None:
            inferences.append(
                AgentInference(
                    claim=(
                        f"{best_option.name} is the strongest option after comparing"
                        " projected curves against do-nothing."
                    ),
                    confidence=0.84,
                )
            )
        return AgentResponse(
            agent_role=self.role_name,
            incident_id=context.incident_id,
            facts=facts,
            inferences=inferences,
            recommendations=recommendations,
            tools_called=[
                "get_incident_context",
                "get_mitigation_playbook",
                "run_pre_action_simulation",
                "write_investigation_note",
            ],
            known_evidence_ids=sorted(evidence_ids),
            allowed_recommendation_actions=sorted(allowed_action_ids),
        )

    @staticmethod
    def _pick_best_option(
        options: list[MitigationOption],
        projections,
    ) -> MitigationOption | None:
        best_option = None
        best_score = None
        options_by_id = {option.action_id: option for option in options}
        for projection in projections:
            option = options_by_id.get(projection.action_id)
            if option is None:
                continue
            end_score = projection.projected_score_curve[-1] if projection.projected_score_curve else 100
            candidate_score = (100 - end_score) * projection.confidence
            if best_score is None or candidate_score > best_score:
                best_score = candidate_score
                best_option = option
        return best_option


class ComplianceSubAgent(BaseRolePlugin):
    role_name = "compliance"

    def run(self, context: AgentExecutionContext, registry: ToolRegistry) -> AgentResponse:
        impact = registry.call(self.role_name, "estimate_impact", context.incident_id)
        audit_trail = registry.call(self.role_name, "get_audit_trail", context.incident_id)
        pack = registry.call(self.role_name, "generate_ncc_pack_draft", context.incident_id)
        validation_result = registry.call(
            self.role_name,
            "validate_claims_against_context",
            impact.get("ncc_exposure_summary", ""),
            context.incident_id,
        )
        facts = []
        if pack is not None:
            facts.append(
                AgentFact(
                    claim="Compliance pack draft is available for review.",
                    evidence_id=f"pack:{context.incident_id}",
                )
            )
        evidence_ids = {fact.evidence_id for fact in facts}
        evidence_ids.update(validation_result.get("evidence_ids", []))
        inferences = []
        ncc_exposure_summary = impact.get("ncc_exposure_summary")
        if isinstance(ncc_exposure_summary, str) and ncc_exposure_summary:
            inferences.append(
                AgentInference(
                    claim=ncc_exposure_summary,
                    confidence=0.88,
                )
            )
        if audit_trail:
            inferences.append(
                AgentInference(
                    claim=f"{len(audit_trail)} approved action(s) are in the audit trail.",
                    confidence=0.82,
                )
            )
        return AgentResponse(
            agent_role=self.role_name,
            incident_id=context.incident_id,
            facts=facts,
            inferences=inferences,
            recommendations=[],
            tools_called=[
                "estimate_impact",
                "get_audit_trail",
                "generate_ncc_pack_draft",
                "validate_claims_against_context",
            ],
            validation_status=validation_result["status"],
            known_evidence_ids=sorted(evidence_ids),
        )


ROLE_PLUGIN_TYPES = {
    "network_risk": NetworkRiskSubAgent,
    "revenue_assurance": RevenueRiskSubAgent,
    "customer_experience": CustomerImpactSubAgent,
    "mitigation": MitigationSubAgent,
    "compliance": ComplianceSubAgent,
}


def domains_to_roles(domains: list[SignalDomain]) -> list[str]:
    roles = []
    domain_set = set(domains)
    if domain_set & {"network", "bts"}:
        roles.append("network_risk")
    if domain_set & {"billing", "sales", "recharge"}:
        roles.append("revenue_assurance")
    if domain_set & {"complaints", "device_sessions"}:
        roles.append("customer_experience")
    return roles
