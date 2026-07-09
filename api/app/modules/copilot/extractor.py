from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
import json
import math
import re
from typing import Any, Literal

from pydantic import BaseModel, ValidationError

from app.core.schemas import AgentFact, AgentResponse
from app.modules.copilot.schemas import AgentEnvelope


EvidenceResolver = Callable[[str], Any | None]
ValidationStatus = Literal["passed", "revised", "rejected"]

FENCED_JSON_RE = re.compile(r"```(?:json)?\s*(?P<body>\{.*?\})\s*```", re.DOTALL)
NUMBER_RE = re.compile(
    r"(?<![A-Za-z0-9_-])"
    r"(?P<value>-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)"
    r"(?P<suffix>[kKmMbB])?"
    r"(?![A-Za-z0-9_-])"
)


class AgentOutputParseError(ValueError):
    """Raised when a model final answer cannot be parsed as an AgentEnvelope."""


@dataclass(frozen=True)
class ClaimValidationIssue:
    claim: str
    evidence_id: str
    reason: str


@dataclass(frozen=True)
class ClaimValidationReport:
    status: ValidationStatus
    issues: list[ClaimValidationIssue]
    kept_fact_count: int
    stripped_fact_count: int


@dataclass(frozen=True)
class AgentExtractionResult:
    envelope: AgentEnvelope
    response: AgentResponse
    validation: ClaimValidationReport


def extract_agent_response(
    raw_output: str,
    evidence_resolver: EvidenceResolver | None = None,
) -> AgentExtractionResult:
    """Parse the v2 agent envelope, map it to AgentResponse, and validate facts."""

    envelope = AgentEnvelope.model_validate(_load_json_object(raw_output))
    response = AgentResponse(
        agent_role=envelope.agent_role,
        incident_id=envelope.incident_id,
        facts=envelope.facts,
        inferences=envelope.inferences,
        recommendations=envelope.recommendations,
        tools_called=envelope.tools_called,
        validation_status="passed",
    )
    if evidence_resolver is None:
        report = ClaimValidationReport(
            status="passed",
            issues=[],
            kept_fact_count=len(response.facts),
            stripped_fact_count=0,
        )
        return AgentExtractionResult(envelope=envelope, response=response, validation=report)

    validated_response, report = validate_agent_response(response, evidence_resolver)
    return AgentExtractionResult(
        envelope=envelope,
        response=validated_response,
        validation=report,
    )


def validate_agent_response(
    response: AgentResponse,
    evidence_resolver: EvidenceResolver,
) -> tuple[AgentResponse, ClaimValidationReport]:
    kept_facts: list[AgentFact] = []
    issues: list[ClaimValidationIssue] = []

    for fact in response.facts:
        evidence = evidence_resolver(fact.evidence_id)
        if evidence is None:
            issues.append(
                ClaimValidationIssue(
                    claim=fact.claim,
                    evidence_id=fact.evidence_id,
                    reason="evidence_id did not resolve",
                )
            )
            continue

        evidence_numbers = list(_numbers_from_evidence(evidence))
        unmatched = [
            number
            for number in _numbers_from_claim(fact.claim)
            if not _matches_any(number, evidence_numbers)
        ]
        if unmatched:
            rendered = ", ".join(_render_number(number) for number in unmatched)
            issues.append(
                ClaimValidationIssue(
                    claim=fact.claim,
                    evidence_id=fact.evidence_id,
                    reason=f"claim number(s) not found in evidence within tolerance: {rendered}",
                )
            )
            continue

        kept_facts.append(fact)

    if not issues:
        status: ValidationStatus = "passed"
    elif response.facts and not kept_facts:
        status = "rejected"
    else:
        status = "revised"

    validated = response.model_copy(
        update={
            "facts": kept_facts,
            "validation_status": status,
            "inferences": [] if status == "rejected" else response.inferences,
            "recommendations": [] if status == "rejected" else response.recommendations,
        }
    )
    report = ClaimValidationReport(
        status=status,
        issues=issues,
        kept_fact_count=len(kept_facts),
        stripped_fact_count=len(response.facts) - len(kept_facts),
    )
    return validated, report


def _load_json_object(raw_output: str) -> dict[str, Any]:
    text = raw_output.strip()
    candidates = [text]

    fenced = FENCED_JSON_RE.search(text)
    if fenced is not None:
        candidates.insert(0, fenced.group("body"))

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidates.append(text[start : end + 1])

    errors: list[str] = []
    for candidate in candidates:
        try:
            loaded = json.loads(candidate)
        except json.JSONDecodeError as exc:
            errors.append(str(exc))
            continue
        if not isinstance(loaded, dict):
            raise AgentOutputParseError("agent output JSON must be an object")
        try:
            AgentEnvelope.model_validate(loaded)
        except ValidationError as exc:
            raise AgentOutputParseError(str(exc)) from exc
        return loaded

    raise AgentOutputParseError("; ".join(errors) or "agent output is not valid JSON")


def _numbers_from_claim(claim: str) -> Iterable[float]:
    for match in NUMBER_RE.finditer(claim):
        yield _coerce_number(match.group("value"), match.group("suffix"))


def _numbers_from_evidence(evidence: Any) -> Iterable[float]:
    if isinstance(evidence, BaseModel):
        evidence = evidence.model_dump(mode="json")

    if isinstance(evidence, bool):
        return
    if isinstance(evidence, int | float):
        if math.isfinite(float(evidence)):
            yield float(evidence)
        return
    if isinstance(evidence, str):
        for match in NUMBER_RE.finditer(evidence):
            yield _coerce_number(match.group("value"), match.group("suffix"))
        return
    if isinstance(evidence, dict):
        for value in evidence.values():
            yield from _numbers_from_evidence(value)
        return
    if isinstance(evidence, list | tuple):
        for value in evidence:
            yield from _numbers_from_evidence(value)


def _coerce_number(raw: str, suffix: str | None) -> float:
    value = float(raw.replace(",", ""))
    multiplier = {"k": 1_000, "m": 1_000_000, "b": 1_000_000_000}.get(
        (suffix or "").lower(),
        1,
    )
    return value * multiplier


def _matches_any(number: float, candidates: Iterable[float]) -> bool:
    return any(_within_tolerance(number, candidate) for candidate in candidates)


def _within_tolerance(number: float, candidate: float) -> bool:
    tolerance = max(0.1, abs(candidate) * 0.01)
    return abs(number - candidate) <= tolerance


def _render_number(number: float) -> str:
    if number.is_integer():
        return str(int(number))
    return str(number)
