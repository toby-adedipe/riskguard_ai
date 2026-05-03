from __future__ import annotations

import asyncio
import json
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, Field
from semantic_kernel.connectors.ai.function_choice_behavior import FunctionChoiceBehavior
from semantic_kernel.connectors.ai.open_ai.prompt_execution_settings.azure_chat_prompt_execution_settings import (
    AzureChatPromptExecutionSettings,
)
from semantic_kernel.const import DEFAULT_FULLY_QUALIFIED_NAME_SEPARATOR
from semantic_kernel.functions.kernel_arguments import KernelArguments
from semantic_kernel.functions import kernel_function

from app.core.config import Settings
from app.core.schemas import AgentFact, AgentInference, AgentRecommendation, AgentResponse
from app.modules.copilot.kernel import SERVICE_ID, build_semantic_kernel
from app.modules.copilot.role_plugins import AgentExecutionContext
from app.modules.copilot.tool_registry import ToolRegistry
from app.modules.copilot.tool_contracts import ROLE_ALLOWED_TOOLS


class StructuredRoleResponse(BaseModel):
    facts: list[AgentFact] = Field(default_factory=list)
    inferences: list[AgentInference] = Field(default_factory=list)
    recommendations: list[AgentRecommendation] = Field(default_factory=list)


ROLE_DIRECTIVES: dict[str, str] = {
    "network_risk": (
        "Investigate network and BTS degradation. Establish why the risk is elevated, "
        "which network signals are moving, and whether there is a clear outage pattern."
    ),
    "revenue_assurance": (
        "Investigate billing, sales, and recharge signals. Establish whether there is "
        "revenue leakage or commercial exposure during the active incident."
    ),
    "customer_experience": (
        "Investigate customer-facing impact using complaints and device-session evidence. "
        "Explain subscriber impact in grounded terms."
    ),
    "mitigation": (
        "Compare mitigation options against the do-nothing path. Recommend one action "
        "only if the playbook and simulation support it."
    ),
    "compliance": (
        "Assess regulatory exposure, auditability, and pack readiness. Keep the answer "
        "grounded in impact, audit trail, pack draft, and claim validation."
    ),
}


ROLE_TOOL_GUIDANCE: dict[str, str] = {
    "network_risk": (
        "Call `get_incident_context`, `get_risk_snapshot`, and `get_signal_evidence` "
        "for `network`, `bts`, and `complaints`. Use `get_feature_windows` only if you need "
        "extra trend context."
    ),
    "revenue_assurance": (
        "Call `get_incident_context`, `estimate_impact`, and `get_signal_evidence` "
        "for `billing`, `sales`, and `recharge`."
    ),
    "customer_experience": (
        "Call `estimate_impact` and `get_signal_evidence` for `complaints` and `device_sessions`."
    ),
    "mitigation": (
        "Call `get_incident_context`, `get_mitigation_playbook`, `run_pre_action_simulation`, "
        "and `write_investigation_note`. Use the action ids returned by the playbook."
    ),
    "compliance": (
        "Call `estimate_impact`, `get_audit_trail`, `generate_ncc_pack_draft`, and "
        "`validate_claims_against_context` before finalizing."
    ),
}


@dataclass
class SemanticKernelRoleRunner:
    settings: Settings
    _runner: asyncio.Runner | None = None

    def run(self, role_name: str, context: AgentExecutionContext, registry: ToolRegistry) -> AgentResponse:
        if self._runner is None:
            self._runner = asyncio.Runner()
        return self._runner.run(self._arun(role_name, context, registry))

    def close(self) -> None:
        if self._runner is not None:
            self._runner.close()
            self._runner = None

    async def _arun(
        self,
        role_name: str,
        context: AgentExecutionContext,
        registry: ToolRegistry,
    ) -> AgentResponse:
        kernel = build_semantic_kernel(self.settings)
        tool_plugin = RoleScopedToolPlugin(role_name=role_name, registry=registry)
        kernel.add_plugin(tool_plugin, plugin_name="backend_tools")
        allowed_function_names = [
            f"backend_tools{DEFAULT_FULLY_QUALIFIED_NAME_SEPARATOR}{tool_name}"
            for tool_name in ROLE_ALLOWED_TOOLS[role_name]
        ]

        prompt_function = kernel.add_function(
            plugin_name="copilot_roles",
            function_name=f"{role_name}_response",
            prompt=self._prompt_for(role_name),
            prompt_execution_settings=AzureChatPromptExecutionSettings(
                service_id=SERVICE_ID,
                temperature=0,
                max_completion_tokens=900,
                function_choice_behavior=FunctionChoiceBehavior.Required(
                    auto_invoke=True,
                    maximum_auto_invoke_attempts=5,
                    filters={
                        "included_plugins": ["backend_tools"],
                        "included_functions": allowed_function_names,
                    },
                ),
            ),
        )

        result = await kernel.invoke(
            function=prompt_function,
            arguments=KernelArguments(
                query=context.query,
                incident_id=context.incident_id,
                lga_id=context.lga_id,
            ),
        )
        response_text = str(result).strip() if result is not None else ""
        payload = StructuredRoleResponse.model_validate(self._extract_json_payload(response_text))
        payload = self._normalize_payload(role_name, payload, tool_plugin)
        return AgentResponse(
            agent_role=role_name,
            incident_id=context.incident_id,
            facts=payload.facts,
            inferences=payload.inferences,
            recommendations=payload.recommendations,
            tools_called=tool_plugin.called_tools,
            known_evidence_ids=sorted(tool_plugin.known_evidence_ids),
            allowed_recommendation_actions=sorted(tool_plugin.allowed_action_ids),
        )

    def _prompt_for(self, role_name: str) -> str:
        directive = ROLE_DIRECTIVES[role_name]
        tool_guidance = ROLE_TOOL_GUIDANCE[role_name]
        return f"""
You are the `{role_name}` sub-agent inside RiskGuard AI.

Mission:
{directive}

Operating rules:
- You must call one or more `backend_tools` functions before answering.
- Use only information returned by tools in this run.
- Facts must include an `evidence_id` taken verbatim from tool outputs.
- Inferences may summarize evidence, but do not invent KPI values, money, subscriber counts, site ids, or actions.
- Recommendations must use action ids returned by tool outputs. If no action is justified, return an empty list.
- Return JSON only. No markdown. No prose outside the JSON object.

Tool guidance:
{tool_guidance}

Incident id: {{{{$incident_id}}}}
LGA id: {{{{$lga_id}}}}
Operator question: {{{{$query}}}}

Return this exact shape:
{{
  "facts": [
    {{"claim": "string", "evidence_id": "string"}}
  ],
  "inferences": [
    {{"claim": "string", "confidence": 0.0}}
  ],
  "recommendations": [
    {{"action": "string", "requires_approval": true}}
  ]
}}
""".strip()

    @staticmethod
    def _extract_json_payload(response_text: str) -> dict[str, Any]:
        trimmed = response_text.strip()
        if trimmed.startswith("```"):
            trimmed = trimmed.strip("`")
            if trimmed.startswith("json"):
                trimmed = trimmed[4:].lstrip()
        decoder = json.JSONDecoder()
        for start_index, character in enumerate(trimmed):
            if character != "{":
                continue
            try:
                payload, _ = decoder.raw_decode(trimmed[start_index:])
                if isinstance(payload, dict):
                    return payload
            except json.JSONDecodeError:
                continue
        raise ValueError(f"Semantic Kernel role response was not valid JSON: {response_text}")

    @staticmethod
    def _normalize_payload(
        role_name: str,
        payload: StructuredRoleResponse,
        tool_plugin: "RoleScopedToolPlugin",
    ) -> StructuredRoleResponse:
        facts = [
            fact
            for fact in payload.facts
            if fact.evidence_id in tool_plugin.known_evidence_ids
        ]
        if role_name == "mitigation":
            recommendations = [
                recommendation
                for recommendation in payload.recommendations
                if recommendation.action in tool_plugin.allowed_action_ids
            ]
        else:
            recommendations = []
        return payload.model_copy(
            update={
                "facts": facts,
                "recommendations": recommendations,
            }
        )


class RoleScopedToolPlugin:
    def __init__(self, *, role_name: str, registry: ToolRegistry) -> None:
        self._role_name = role_name
        self._registry = registry
        self.called_tools: list[str] = []
        self.known_evidence_ids: set[str] = set()
        self.allowed_action_ids: set[str] = set()

    @kernel_function(description="Get the current risk snapshot for one LGA.")
    def get_risk_snapshot(self, lga_id: str) -> str:
        result = self._registry.call(self._role_name, "get_risk_snapshot", lga_id)
        payload = self._jsonable(result)
        return self._record("get_risk_snapshot", payload)

    @kernel_function(description="Get the canonical incident context by incident id or LGA id.")
    def get_incident_context(self, incident_id: str = "", lga_id: str = "") -> str:
        result = self._registry.call(
            self._role_name,
            "get_incident_context",
            incident_id=incident_id or None,
            lga_id=lga_id or None,
        )
        payload = self._jsonable(result)
        return self._record("get_incident_context", payload)

    @kernel_function(description="Get normalized signal evidence for the requested domains in one LGA.")
    def get_signal_evidence(self, lga_id: str, domains: list[str], limit: int = 10) -> str:
        result = self._registry.call(self._role_name, "get_signal_evidence", lga_id, domains, limit)
        payload = self._jsonable(result)
        return self._record("get_signal_evidence", payload)

    @kernel_function(description="Get rolling feature windows and anomaly scores for the requested domains.")
    def get_feature_windows(self, lga_id: str, domains: list[str]) -> str:
        result = self._registry.call(self._role_name, "get_feature_windows", lga_id, domains)
        payload = self._jsonable(result)
        return self._record("get_feature_windows", payload)

    @kernel_function(description="Estimate customer, revenue, and regulatory impact for an incident.")
    def estimate_impact(self, incident_id: str) -> str:
        result = self._registry.call(self._role_name, "estimate_impact", incident_id)
        payload = self._jsonable(result)
        return self._record("estimate_impact", payload)

    @kernel_function(description="Get the mitigation playbook for a risk type.")
    def get_mitigation_playbook(self, risk_type: str) -> str:
        result = self._registry.call(self._role_name, "get_mitigation_playbook", risk_type)
        payload = self._jsonable(result)
        return self._record("get_mitigation_playbook", payload)

    @kernel_function(description="Run pre-action simulation for one or more mitigation options.")
    def run_pre_action_simulation(self, incident_id: str, action_ids: list[str]) -> str:
        result = self._registry.call(
            self._role_name,
            "run_pre_action_simulation",
            incident_id,
            action_ids,
        )
        payload = self._jsonable(result)
        return self._record("run_pre_action_simulation", payload)

    @kernel_function(description="Get the append-only audit trail for an incident.")
    def get_audit_trail(self, incident_id: str) -> str:
        result = self._registry.call(self._role_name, "get_audit_trail", incident_id)
        payload = self._jsonable(result)
        return self._record("get_audit_trail", payload)

    @kernel_function(description="Generate the NCC pack draft for an incident.")
    def generate_ncc_pack_draft(self, incident_id: str) -> str:
        pack = self._registry.call(self._role_name, "generate_ncc_pack_draft", incident_id)
        payload = {
            "pack_id": f"pack:{incident_id}",
            "pack": self._jsonable(pack),
        }
        return self._record("generate_ncc_pack_draft", payload)

    @kernel_function(description="Validate a compliance or risk statement against the current context.")
    def validate_claims_against_context(self, text: str, context_id: str) -> str:
        result = self._registry.call(
            self._role_name,
            "validate_claims_against_context",
            text,
            context_id,
        )
        payload = self._jsonable(result)
        return self._record("validate_claims_against_context", payload)

    @kernel_function(description="Write a short investigation note tied to evidence ids.")
    def write_investigation_note(
        self,
        incident_id: str,
        agent_role: str,
        summary: str,
        evidence_ids: list[str],
    ) -> str:
        result = self._registry.call(
            self._role_name,
            "write_investigation_note",
            incident_id,
            agent_role,
            summary,
            evidence_ids,
        )
        payload = self._jsonable(result)
        return self._record("write_investigation_note", payload)

    def _record(self, tool_name: str, payload: Any) -> str:
        self.called_tools.append(tool_name)
        self.known_evidence_ids.update(self._extract_evidence_ids(payload))
        if tool_name in {"get_mitigation_playbook", "run_pre_action_simulation"}:
            self.allowed_action_ids.update(self._extract_action_ids(payload))
        return json.dumps(payload, default=str)

    @classmethod
    def _jsonable(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, BaseModel):
            return value.model_dump(mode="json")
        if isinstance(value, dict):
            return {key: cls._jsonable(item) for key, item in value.items()}
        if isinstance(value, list):
            return [cls._jsonable(item) for item in value]
        return value

    @classmethod
    def _extract_evidence_ids(cls, value: Any) -> set[str]:
        evidence_ids: set[str] = set()
        for node in cls._walk(value):
            if not isinstance(node, dict):
                continue
            evidence_id = node.get("evidence_id")
            if isinstance(evidence_id, str) and evidence_id:
                evidence_ids.add(evidence_id)
            plural = node.get("evidence_ids")
            if isinstance(plural, list):
                evidence_ids.update(item for item in plural if isinstance(item, str) and item)
            note_id = node.get("note_id")
            if isinstance(note_id, str) and note_id:
                evidence_ids.add(note_id)
            pack_id = node.get("pack_id")
            if isinstance(pack_id, str) and pack_id:
                evidence_ids.add(pack_id)
        return evidence_ids

    @classmethod
    def _extract_action_ids(cls, value: Any) -> set[str]:
        action_ids: set[str] = set()
        for node in cls._walk(value):
            if not isinstance(node, dict):
                continue
            action_id = node.get("action_id")
            if isinstance(action_id, str) and action_id:
                action_ids.add(action_id)
        return action_ids

    @classmethod
    def _walk(cls, value: Any) -> Iterable[Any]:
        yield value
        if isinstance(value, dict):
            for item in value.values():
                yield from cls._walk(item)
        elif isinstance(value, list):
            for item in value:
                yield from cls._walk(item)
