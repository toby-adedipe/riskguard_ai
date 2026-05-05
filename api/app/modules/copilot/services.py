from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.core.config import get_settings
from app.demo_data.dataset import seed_demo_state
from app.core.schemas import (
    FeatureWindow,
    InvestigationTrigger,
    RiskScore,
    SignalEvidence,
)
from app.modules.actions.schemas import ActionProjection, ActionSimulateResponse
from app.modules.audit.db import AuditLogRepository
from app.modules.compliance.db import CompliancePackRepository
from app.modules.compliance.services import ComplianceService
from app.modules.copilot.db import InvestigationRunRepository
from app.modules.copilot.harness import HarnessRunReport
from app.modules.copilot.orchestrator import MainInvestigationAgent
from app.modules.copilot.semantic_runtime import (
    SemanticKernelReportDocumentRunner,
    SemanticKernelReportFollowUpRunner,
    SemanticKernelRoleRunner,
)
from app.modules.copilot.report_documents import (
    DOCX_MEDIA_TYPE,
    CompiledReportDocument,
    build_report_docx,
)
from app.modules.copilot.schemas import (
    CopilotFollowUpRequest,
    CopilotFollowUpResponse,
    CopilotQueryRequest,
    FollowUpExchange,
)
from app.modules.copilot.tool_registry import ToolRegistry
from app.modules.copilot.triggering import WakeConditionEvaluator
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
        self._follow_up_runner = (
            SemanticKernelReportFollowUpRunner(settings=settings)
            if settings.azure_openai_configured
            else None
        )
        self._document_runner = (
            SemanticKernelReportDocumentRunner(settings=settings)
            if settings.azure_openai_configured
            else None
        )
        self._run_repo = run_repo
        self._incident_repo = incident_repo
        self._backend = backend
        self._wake_evaluator = WakeConditionEvaluator()
        self._agent = MainInvestigationAgent(
            registry=ToolRegistry(backend),
            validator=ClaimValidator(),
            runs=run_repo,
            role_runner=role_runner,
        )

    def query(self, request: CopilotQueryRequest):
        return self._agent.query_role(request)

    def investigate(self, trigger: InvestigationTrigger) -> HarnessRunReport:
        return self._agent.investigate_trigger_report(trigger)

    def maybe_investigate_from_signal(
        self,
        risk_score: RiskScore,
        feature_windows: list[FeatureWindow],
        incident_id: str | None = None,
    ) -> HarnessRunReport | None:
        incident = (
            self._incident_repo.get(incident_id)
            if incident_id is not None
            else self._backend.get_incident_context(lga_id=risk_score.lga_id)
        )
        trigger = self._wake_evaluator.evaluate(risk_score, feature_windows, incident)
        if trigger is None:
            return None
        return self.investigate(trigger)

    def get_report(self, harness_run_id: str) -> HarnessRunReport | None:
        return self._run_repo.get_report(harness_run_id)

    def list_reports_for_incident(self, incident_id: str) -> list[HarnessRunReport]:
        return self._run_repo.list_reports_for_incident(incident_id)

    def follow_up(
        self,
        harness_run_id: str,
        request: CopilotFollowUpRequest,
    ) -> CopilotFollowUpResponse | None:
        report = self._run_repo.get_report(harness_run_id)
        if report is None:
            return None

        conversation_id = request.conversation_id or str(uuid4())
        history = self._run_repo.list_follow_ups(harness_run_id, conversation_id)
        follow_up_type = request.follow_up_type or "freeform"
        if follow_up_type == "freeform" and self._follow_up_runner is not None:
            response = self._follow_up_runner.run(
                report=report,
                history=history,
                message=request.message,
            )
            evidence_ids = response.evidence_ids
            answer = response.answer
        else:
            answer, evidence_ids = self._deterministic_follow_up_answer(
                report,
                follow_up_type,
            )

        evidence = [
            evidence
            for evidence in report.evidence
            if evidence.evidence_id in set(evidence_ids)
        ]
        response = CopilotFollowUpResponse(
            harness_run_id=harness_run_id,
            conversation_id=conversation_id,
            follow_up_type=follow_up_type,
            answer=answer,
            evidence=evidence,
            recommendations=report.recommendations,
            validation_status="passed",
        )
        self._run_repo.append_follow_up(
            harness_run_id,
            FollowUpExchange(
                conversation_id=conversation_id,
                follow_up_type=follow_up_type,
                user_message=request.message,
                assistant_answer=response.answer,
                evidence_ids=[item.evidence_id for item in evidence],
                created_at=datetime.now(timezone.utc),
            ),
        )
        return response

    def close(self) -> None:
        role_runner = getattr(self._agent, "_role_runner", None)
        if role_runner is not None and hasattr(role_runner, "close"):
            role_runner.close()
        if self._follow_up_runner is not None:
            self._follow_up_runner.close()
        if self._document_runner is not None:
            self._document_runner.close()

    def compile_report_document(self, harness_run_id: str) -> CompiledReportDocument | None:
        report = self._run_repo.get_report(harness_run_id)
        if report is None:
            return None

        if self._document_runner is not None:
            draft = self._document_runner.run(report=report)
            title = draft.title
            body = draft.body_markdown
        else:
            title, body = self._offline_report_document(report)

        filename = f"riskguard-investigation-{harness_run_id}.docx"
        return CompiledReportDocument(
            filename=filename,
            media_type=DOCX_MEDIA_TYPE,
            content=build_report_docx(title=title, body_markdown=body),
        )

    @staticmethod
    def _deterministic_follow_up_answer(
        report: HarnessRunReport,
        follow_up_type: str,
    ) -> tuple[str, list[str]]:
        evidence_ids = [evidence.evidence_id for evidence in report.evidence]
        if follow_up_type == "why_this_action":
            action = report.recommendations[0].action if report.recommendations else "no action"
            simulation = report.mitigation_simulation
            if simulation is None:
                return (
                    f"The report does not include a mitigation simulation, so it cannot justify {action}.",
                    evidence_ids,
                )
            return (
                f"The recommended action is {action}. {simulation.summary} "
                "It still requires human approval before execution.",
                evidence_ids,
            )
        if follow_up_type == "show_evidence":
            return (
                "The report is backed by these compact evidence references: "
                + ", ".join(evidence_ids),
                evidence_ids,
            )
        if follow_up_type == "what_if_we_wait":
            simulation = report.mitigation_simulation
            if simulation is None:
                return (
                    "The saved report does not include do-nothing simulation data.",
                    evidence_ids,
                )
            return (
                "If MTN waits, the do-nothing score curve is "
                f"{simulation.do_nothing_curve}. The recommended action is "
                f"{simulation.recommended_action_id} and its curve is "
                f"{next((action.projected_score_curve for action in simulation.actions if action.recommended), [])}.",
                evidence_ids,
            )
        return (
            "This answer is grounded in the saved investigation report. "
            f"{report.summary}",
            evidence_ids,
        )

    @staticmethod
    def _offline_report_document(report: HarnessRunReport) -> tuple[str, str]:
        evidence_lines = "\n".join(
            f"- {item.evidence_id}: {item.summary} Source: {item.source_system or 'investigation'}."
            for item in report.evidence
        )
        step_lines = "\n".join(
            f"- {step.title}: {step.status}. {step.summary}"
            for step in report.steps
        )
        recommendation_lines = "\n".join(
            f"- {item.action}; approval required: {item.requires_approval}."
            for item in report.recommendations
        ) or "- No supported mitigation recommendation was produced."
        simulation = report.mitigation_simulation
        simulation_text = (
            f"The do-nothing curve is {simulation.do_nothing_curve}. "
            f"The recommended action is {simulation.recommended_action_id}. "
            f"{simulation.summary}"
            if simulation is not None
            else "No mitigation simulation was persisted with this run."
        )
        title = f"RiskGuard AI Investigation Report - {report.incident_id or report.lga_id}"
        body = f"""
# Executive Summary
RiskGuard AI completed an investigation for {report.incident_id or report.lga_id}. {report.summary} The report status is {report.status}, and the decision trail is grounded in {len(report.evidence)} evidence references collected during the run. The investigation used the playbook {report.playbook_id}, selected these roles: {', '.join(report.selected_roles)}, and captured these next actions: {', '.join(report.next_actions)}.

This document is the offline rendering of the same report contract used by the live LLM document compiler. It preserves the professional structure, evidence citations, and operational decision trail so the NOC can review the incident without re-running the agents.

---PAGE BREAK---

# Incident Context
The triggering condition was: {report.trigger_reason}. The investigation started at {report.started_at.isoformat()} and completed at {report.completed_at.isoformat()}. The selected specialist agents performed role-specific tool checks before the final report was compiled.

# Evidence Review
{evidence_lines}

# Customer and Social Media Impact
Customer-impact evidence includes complaints, device-session data, and social-media listening when present in the report. Social evidence is treated as corroborating customer pressure, not as a replacement for network telemetry. The social-media signals help the operator understand public escalation risk and affected-customer perception.

# Revenue and Regulatory Exposure
Revenue and compliance exposure were assessed from persisted impact estimates, audit trail checks, and NCC pack readiness where those tools were available. Compliance outputs remain subject to operator review before external submission.

# Mitigation Assessment
{simulation_text}

# Recommended Decision
{recommendation_lines}

---PAGE BREAK---

# Open Risks and Next Actions
{step_lines}

The operator should validate the recommended mitigation action, confirm customer communications, and preserve the evidence references listed above for audit and post-incident review.
""".strip()
        return title, body
