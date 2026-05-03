from __future__ import annotations

from collections.abc import Callable, Iterable
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from app.core.schemas import (
    AgentRecommendation,
    AgentResponse,
    InvestigationTrigger,
    SignalDomain,
)
from app.modules.copilot.role_plugins import (
    AgentExecutionContext,
    ComplianceSubAgent,
    MitigationSubAgent,
    domains_to_roles,
)
from app.modules.copilot.tool_registry import ToolRegistry


HarnessStepKind = Literal[
    "collect_context",
    "run_agent",
    "verify_mitigation",
    "verify_compliance",
    "compile_report",
]


class HarnessPlaybookStep(BaseModel):
    step_id: str
    kind: HarnessStepKind
    title: str
    description: str
    role: str | None = None
    required_tools: list[str] = Field(default_factory=list)


class HarnessPlaybook(BaseModel):
    playbook_id: str
    title: str
    steps: list[HarnessPlaybookStep]


class HarnessStepResult(BaseModel):
    step_id: str
    kind: HarnessStepKind
    title: str
    status: Literal["passed", "failed", "skipped"]
    role: str | None = None
    tools_called: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    recommendations: list[AgentRecommendation] = Field(default_factory=list)
    validation_status: str | None = None
    summary: str = ""
    missing_tools: list[str] = Field(default_factory=list)


class HarnessRunReport(BaseModel):
    harness_run_id: str
    playbook_id: str
    lga_id: str
    incident_id: str | None = None
    trigger_reason: str
    selected_roles: list[str] = Field(default_factory=list)
    status: Literal["passed", "failed"]
    started_at: datetime
    completed_at: datetime
    steps: list[HarnessStepResult]
    tools_called: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    recommendations: list[AgentRecommendation] = Field(default_factory=list)
    summary: str


RunRole = Callable[[str, AgentExecutionContext], AgentResponse]
ValidateResponse = Callable[[AgentResponse], AgentResponse]


class InvestigationHarness:
    """Executes the wake-on-signal investigation playbook.

    The harness is deliberately deterministic. It decides the investigation
    sequence and required checks; sub-agents do the role-specific reasoning.
    """

    def __init__(
        self,
        *,
        registry: ToolRegistry,
        run_role: RunRole,
        validate_response: ValidateResponse,
    ) -> None:
        self._registry = registry
        self._run_role = run_role
        self._validate_response = validate_response

    def run(self, trigger: InvestigationTrigger) -> HarnessRunReport:
        started_at = datetime.now(timezone.utc)
        selected_roles = self._select_roles(trigger)
        playbook = build_default_investigation_playbook(selected_roles)
        results: list[HarnessStepResult] = []

        for step in playbook.steps:
            if step.kind == "collect_context":
                results.append(self._collect_context(step, trigger))
                continue
            if step.kind == "run_agent" and step.role is not None:
                results.append(self._run_agent_step(step, trigger))
                continue
            if step.kind == "verify_mitigation":
                results.append(self._verify_step(step, results, required_role=MitigationSubAgent.role_name))
                continue
            if step.kind == "verify_compliance":
                results.append(self._verify_step(step, results, required_role=ComplianceSubAgent.role_name))
                continue
            if step.kind == "compile_report":
                results.append(self._compile_step(step, results))

        status = "passed" if all(result.status != "failed" for result in results) else "failed"
        tools_called = sorted({tool for result in results for tool in result.tools_called})
        evidence_ids = sorted({evidence_id for result in results for evidence_id in result.evidence_ids})
        recommendations = self._dedupe_recommendations(
            recommendation
            for result in results
            for recommendation in result.recommendations
        )
        summary = self._build_summary(trigger, results, recommendations)
        return HarnessRunReport(
            harness_run_id=str(uuid4()),
            playbook_id=playbook.playbook_id,
            lga_id=trigger.lga_id,
            incident_id=trigger.incident_id,
            trigger_reason=trigger.reason,
            selected_roles=selected_roles,
            status=status,
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
            steps=results,
            tools_called=tools_called,
            evidence_ids=evidence_ids,
            recommendations=recommendations,
            summary=summary,
        )

    def _collect_context(
        self,
        step: HarnessPlaybookStep,
        trigger: InvestigationTrigger,
    ) -> HarnessStepResult:
        tools_called = []
        evidence_ids: set[str] = set()

        incident = self._registry.call(
            "investigation_harness",
            "get_incident_context",
            incident_id=trigger.incident_id,
            lga_id=trigger.lga_id,
        )
        tools_called.append("get_incident_context")

        risk = self._registry.call(
            "investigation_harness",
            "get_risk_snapshot",
            trigger.lga_id,
        )
        tools_called.append("get_risk_snapshot")

        domains = trigger.triggered_domains or self._all_domains_for_incident()
        feature_windows = self._registry.call(
            "investigation_harness",
            "get_feature_windows",
            trigger.lga_id,
            domains,
        )
        tools_called.append("get_feature_windows")

        for window in feature_windows:
            evidence_ids.update(window.evidence_ids)

        missing_tools = self._missing_tools(step.required_tools, tools_called)
        status = "failed" if missing_tools or risk is None or incident is None else "passed"
        return HarnessStepResult(
            step_id=step.step_id,
            kind=step.kind,
            title=step.title,
            status=status,
            tools_called=tools_called,
            evidence_ids=sorted(evidence_ids),
            summary="Collected incident, risk snapshot, and feature-window context.",
            missing_tools=missing_tools,
        )

    def _run_agent_step(
        self,
        step: HarnessPlaybookStep,
        trigger: InvestigationTrigger,
    ) -> HarnessStepResult:
        if trigger.incident_id is None or step.role is None:
            return HarnessStepResult(
                step_id=step.step_id,
                kind=step.kind,
                title=step.title,
                status="skipped",
                role=step.role,
                summary="No active incident id was available for this role step.",
            )

        context = AgentExecutionContext(
            incident_id=trigger.incident_id,
            lga_id=trigger.lga_id,
            query=step.description,
        )
        response = self._validate_response(self._run_role(step.role, context))
        missing_tools = self._missing_tools(step.required_tools, response.tools_called)
        status = "passed" if response.validation_status == "passed" and not missing_tools else "failed"
        evidence_ids = sorted({fact.evidence_id for fact in response.facts})
        return HarnessStepResult(
            step_id=step.step_id,
            kind=step.kind,
            title=step.title,
            status=status,
            role=step.role,
            tools_called=response.tools_called,
            evidence_ids=evidence_ids,
            recommendations=response.recommendations,
            validation_status=response.validation_status,
            summary=self._summarize_response(response),
            missing_tools=missing_tools,
        )

    @staticmethod
    def _verify_step(
        step: HarnessPlaybookStep,
        results: list[HarnessStepResult],
        *,
        required_role: str,
    ) -> HarnessStepResult:
        role_results = [result for result in results if result.role == required_role]
        tools_called = sorted({tool for result in role_results for tool in result.tools_called})
        recommendations = [
            recommendation
            for result in role_results
            for recommendation in result.recommendations
        ]
        missing_tools = InvestigationHarness._missing_tools(step.required_tools, tools_called)
        status = "passed" if role_results and not missing_tools else "failed"
        if required_role == MitigationSubAgent.role_name and not recommendations:
            status = "failed"
        return HarnessStepResult(
            step_id=step.step_id,
            kind=step.kind,
            title=step.title,
            status=status,
            role=required_role,
            tools_called=tools_called,
            recommendations=recommendations,
            summary="Verified required role outputs and tool calls.",
            missing_tools=missing_tools,
        )

    @staticmethod
    def _compile_step(
        step: HarnessPlaybookStep,
        results: list[HarnessStepResult],
    ) -> HarnessStepResult:
        failed = [result for result in results if result.status == "failed"]
        evidence_ids = sorted({evidence_id for result in results for evidence_id in result.evidence_ids})
        recommendations = [
            recommendation
            for result in results
            for recommendation in result.recommendations
        ]
        return HarnessStepResult(
            step_id=step.step_id,
            kind=step.kind,
            title=step.title,
            status="failed" if failed else "passed",
            evidence_ids=evidence_ids,
            recommendations=recommendations,
            summary="Compiled investigation report from validated sub-agent outputs.",
        )

    @staticmethod
    def _select_roles(trigger: InvestigationTrigger) -> list[str]:
        roles = domains_to_roles(trigger.triggered_domains)
        if trigger.score is not None and trigger.score >= 75:
            roles.append(MitigationSubAgent.role_name)
        if trigger.score is not None and trigger.score >= 80:
            roles.append(ComplianceSubAgent.role_name)
        deduped = []
        for role in roles:
            if role not in deduped:
                deduped.append(role)
        return deduped

    @staticmethod
    def _all_domains_for_incident() -> list[SignalDomain]:
        return [
            "network",
            "bts",
            "billing",
            "sales",
            "recharge",
            "complaints",
            "device_sessions",
        ]

    @staticmethod
    def _missing_tools(required_tools: list[str], tools_called: list[str]) -> list[str]:
        called = set(tools_called)
        return [tool for tool in required_tools if tool not in called]

    @staticmethod
    def _summarize_response(response: AgentResponse) -> str:
        if response.inferences:
            return response.inferences[0].claim
        if response.facts:
            return response.facts[0].claim
        return f"{response.agent_role} returned no grounded facts."

    @staticmethod
    def _build_summary(
        trigger: InvestigationTrigger,
        results: list[HarnessStepResult],
        recommendations: list[AgentRecommendation],
    ) -> str:
        parts = [f"Triggered because {trigger.reason}."]
        passed_roles = [result.role for result in results if result.kind == "run_agent" and result.status == "passed"]
        if passed_roles:
            parts.append(f"Completed role checks: {', '.join(role for role in passed_roles if role)}.")
        if recommendations:
            parts.append(
                "Recommended action: "
                + ", ".join(recommendation.action for recommendation in recommendations)
                + "."
            )
        return " ".join(parts)

    @staticmethod
    def _dedupe_recommendations(
        recommendations: Iterable[AgentRecommendation],
    ) -> list[AgentRecommendation]:
        deduped: dict[str, AgentRecommendation] = {}
        for recommendation in recommendations:
            deduped.setdefault(recommendation.action, recommendation)
        return list(deduped.values())


def build_default_investigation_playbook(selected_roles: list[str]) -> HarnessPlaybook:
    steps = [
        HarnessPlaybookStep(
            step_id="collect_context",
            kind="collect_context",
            title="Collect Incident Context",
            description="Read the risk snapshot, incident context, and feature windows before invoking role agents.",
            required_tools=["get_incident_context", "get_risk_snapshot", "get_feature_windows"],
        )
    ]
    for role in selected_roles:
        steps.append(_role_step(role))
    if MitigationSubAgent.role_name in selected_roles:
        steps.append(
            HarnessPlaybookStep(
                step_id="verify_mitigation",
                kind="verify_mitigation",
                title="Verify Mitigation Simulation",
                description="Confirm that mitigation recommendations are based on playbook options and pre-action simulation.",
                role=MitigationSubAgent.role_name,
                required_tools=["get_mitigation_playbook", "run_pre_action_simulation"],
            )
        )
    if ComplianceSubAgent.role_name in selected_roles:
        steps.append(
            HarnessPlaybookStep(
                step_id="verify_compliance",
                kind="verify_compliance",
                title="Verify Compliance Pack Readiness",
                description="Confirm regulatory exposure was checked against audit trail, NCC pack draft, and validation tools.",
                role=ComplianceSubAgent.role_name,
                required_tools=["estimate_impact", "get_audit_trail", "generate_ncc_pack_draft", "validate_claims_against_context"],
            )
        )
    steps.append(
        HarnessPlaybookStep(
            step_id="compile_report",
            kind="compile_report",
            title="Compile Operator Report",
            description="Compile the validated facts, inferences, simulations, and recommendations into one operator-facing result.",
        )
    )
    return HarnessPlaybook(
        playbook_id="mvp-wake-on-signal-investigation",
        title="MVP Wake-On-Signal Investigation Playbook",
        steps=steps,
    )


def _role_step(role: str) -> HarnessPlaybookStep:
    required_tools_by_role = {
        "network_risk": ["get_incident_context", "get_risk_snapshot", "get_signal_evidence"],
        "revenue_assurance": ["get_incident_context", "estimate_impact", "get_signal_evidence"],
        "customer_experience": ["estimate_impact", "get_signal_evidence"],
        "mitigation": ["get_incident_context", "get_mitigation_playbook", "run_pre_action_simulation", "write_investigation_note"],
        "compliance": ["estimate_impact", "get_audit_trail", "generate_ncc_pack_draft", "validate_claims_against_context"],
    }
    descriptions_by_role = {
        "network_risk": "Check network and BTS evidence, feature-window trends, and root-cause clues.",
        "revenue_assurance": "Check billing, sales, and recharge exposure tied to the incident.",
        "customer_experience": "Check complaints, device-session failures, and subscriber impact.",
        "mitigation": "Fetch the mitigation playbook, run pre-action simulations, and recommend the best supported action.",
        "compliance": "Check NCC exposure, auditability, pack readiness, and claim validation.",
    }
    return HarnessPlaybookStep(
        step_id=f"run_{role}",
        kind="run_agent",
        title=f"Run {role.replace('_', ' ').title()}",
        description=descriptions_by_role[role],
        role=role,
        required_tools=required_tools_by_role[role],
    )
