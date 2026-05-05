from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import uuid4
from typing import Protocol

from app.core.schemas import AgentCitation, AgentResponse, InvestigationRun, InvestigationTrigger
from app.modules.copilot.db import InvestigationRunRepository
from app.modules.copilot.harness import HarnessRunReport, InvestigationHarness
from app.modules.copilot.role_plugins import (
    AgentExecutionContext,
    ROLE_PLUGIN_TYPES,
    ComplianceSubAgent,
    MitigationSubAgent,
    domains_to_roles,
)
from app.modules.copilot.schemas import CopilotQueryRequest
from app.modules.copilot.tool_registry import ToolRegistry
from app.modules.copilot.validation import ClaimValidator


_LOGGER = logging.getLogger(__name__)


class RoleRunner(Protocol):
    def run(self, role_name: str, context: AgentExecutionContext, registry: ToolRegistry) -> AgentResponse: ...


class MainInvestigationAgent:
    """Main control-plane agent that delegates domain work to sub-agents."""

    def __init__(
        self,
        *,
        registry: ToolRegistry,
        validator: ClaimValidator,
        runs: InvestigationRunRepository,
        role_runner: RoleRunner | None = None,
    ) -> None:
        self._registry = registry
        self._validator = validator
        self._runs = runs
        self._role_runner = role_runner

    def query_role(self, request: CopilotQueryRequest) -> AgentResponse:
        incident = self._registry.call(
            request.role,
            "get_incident_context",
            incident_id=request.incident_id,
        )
        lga_id = incident.lga_id if incident is not None else "unknown"
        context = AgentExecutionContext(
            incident_id=request.incident_id,
            lga_id=lga_id,
            query=request.query,
        )
        raw_response = self._run_role(request.role, context)
        return self._finalize_response(self._validate_response(raw_response))

    def investigate_trigger(self, trigger: InvestigationTrigger) -> InvestigationRun:
        run, _ = self._run_and_persist(trigger)
        return run

    def investigate_trigger_report(self, trigger: InvestigationTrigger) -> HarnessRunReport:
        _, harness_report = self._run_and_persist(trigger)
        return harness_report

    def _run_and_persist(
        self,
        trigger: InvestigationTrigger,
    ) -> tuple[InvestigationRun, HarnessRunReport]:
        harness_report = self.run_harness(trigger)
        run = InvestigationRun(
            run_id=str(uuid4()),
            harness_run_id=harness_report.harness_run_id,
            lga_id=trigger.lga_id,
            incident_id=trigger.incident_id,
            trigger=trigger,
            selected_roles=harness_report.selected_roles,
            tools_called=[],
            status="running",
            created_at=datetime.now(timezone.utc),
        )
        self._runs.create(run)
        self._runs.create_report(harness_report)

        completed = run.model_copy(
            update={
                "status": "completed" if harness_report.status == "passed" else "failed",
                "summary": harness_report.summary,
                "tools_called": harness_report.tools_called,
                "completed_at": harness_report.completed_at,
            }
        )
        self._runs.update(completed)
        return completed, harness_report

    def run_harness(self, trigger: InvestigationTrigger):
        harness = InvestigationHarness(
            registry=self._registry,
            run_role=self._run_role,
            validate_response=self._validate_response,
        )
        return harness.run(trigger)

    def _select_roles(self, trigger: InvestigationTrigger) -> list[str]:
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

    def _validate_response(self, response: AgentResponse) -> AgentResponse:
        evidence_ids = set(response.known_evidence_ids)
        allowed_actions = set(response.allowed_recommendation_actions)
        return self._validator.validate(
            response,
            known_evidence_ids=evidence_ids,
            allowed_actions=allowed_actions,
        )

    @staticmethod
    def _finalize_response(response: AgentResponse) -> AgentResponse:
        citations = [
            AgentCitation(evidence_id=fact.evidence_id, label=fact.claim)
            for fact in response.facts
        ]
        answer = response.answer
        if answer is None:
            parts = [fact.claim for fact in response.facts[:2]]
            parts.extend(inference.claim for inference in response.inferences[:1])
            answer = " ".join(parts).strip() or "I could not find grounded evidence for that question."
        return response.model_copy(update={"answer": answer, "citations": citations})

    def _run_role(self, role_name: str, context: AgentExecutionContext) -> AgentResponse:
        if self._role_runner is not None:
            try:
                return self._role_runner.run(role_name, context, self._registry)
            except Exception:
                _LOGGER.warning(
                    "Live role runner failed for %s; falling back to deterministic role plugin.",
                    role_name,
                    exc_info=True,
                )
        plugin = ROLE_PLUGIN_TYPES[role_name]()
        return plugin.run(context, self._registry)

    @staticmethod
    def _summarize(reason: str, responses: list[AgentResponse]) -> str:
        fragments = [reason]
        for response in responses:
            if response.inferences:
                fragments.append(response.inferences[0].claim)
        return " ".join(fragment for fragment in fragments if fragment).strip()
