from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from app.core.schemas import AgentFact, AgentResponse, FeatureWindow, InvestigationTrigger, RiskScore
from app.demo_data.dataset import load_demo_scenario
from app.modules.audit.db import AuditLogRepository
from app.modules.compliance.db import CompliancePackRepository
from app.modules.copilot.schemas import CopilotFollowUpRequest
from app.modules.copilot.services import DemoCopilotToolBackend
from app.modules.copilot.tool_registry import ToolRegistry
from app.modules.copilot.validation import ClaimValidator
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository
from evals.run_live_copilot_evals import build_live_service


def main() -> int:
    parser = argparse.ArgumentParser(description="Run live hardening evals for the copilot harness.")
    parser.add_argument("--limit", type=int, default=None, help="Run only the first N cases.")
    args = parser.parse_args()

    eval_path = Path(__file__).with_name("eval-source-copilot-harness-hardening.jsonl")
    if not eval_path.exists():
        raise FileNotFoundError(f"Missing eval slice: {eval_path}")

    with eval_path.open("r", encoding="utf-8") as handle:
        cases = [json.loads(line) for line in handle if line.strip()]

    if args.limit is not None:
        cases = cases[: args.limit]

    service = build_live_service()
    failures: list[str] = []
    try:
        for case in cases:
            case_failures = _run_case(service, case)
            if case_failures:
                failures.append(f"{case['evalId']}: " + "; ".join(case_failures))
                status = "FAIL"
            else:
                status = "PASS"
            print(f"[{status}] {case['evalId']} mode={case['mode']}")
    finally:
        service.close()

    if failures:
        print("\nFailures:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print(f"\nAll {len(cases)} live hardening evals passed.")
    return 0


def _run_case(service, case: dict) -> list[str]:
    mode = case["mode"]
    if mode in {"below_threshold_no_wake", "threshold_wake_roles"}:
        return _check_wake_case(service, case)
    if mode == "follow_up_wait_comparison":
        return _check_follow_up_case(service, case)
    if mode == "missing_evidence_revised":
        return _check_missing_evidence_case(case)
    if mode == "bad_tool_call_rejected":
        return _check_bad_tool_call_case(case)
    if mode == "commercial_only_no_mitigation":
        return _check_commercial_only_case(service, case)
    return [f"unsupported eval mode {mode!r}"]


def _check_wake_case(service, case: dict) -> list[str]:
    signal = case["signal"]
    expectation = case["expectation"]
    report = service.maybe_investigate_from_signal(
        _score_from_signal(signal),
        _feature_windows_from_signal(signal),
        signal.get("incidentId"),
    )
    should_wake = expectation["shouldWake"]
    if not should_wake:
        return [] if report is None else ["expected no wake-up report"]
    if report is None:
        return ["expected wake-up report"]
    return _check_report(report, expectation)


def _check_follow_up_case(service, case: dict) -> list[str]:
    report = service.investigate(_trigger_from_case(case))
    follow_up = case["followUp"]
    response = service.follow_up(
        report.harness_run_id,
        CopilotFollowUpRequest(
            follow_up_type=follow_up["followUpType"],
            message=follow_up["message"],
        ),
    )
    failures: list[str] = []
    if response is None:
        return ["missing follow-up response"]
    if case["expectation"].get("requiresMitigationSimulation") and report.mitigation_simulation is None:
        failures.append("missing mitigation simulation")
    if case["expectation"].get("requiresEvidence") and not response.evidence:
        failures.append("missing follow-up evidence")
    return failures


def _check_missing_evidence_case(case: dict) -> list[str]:
    payload = case["response"]
    response = AgentResponse(
        agent_role=payload["agentRole"],
        incident_id=payload["incidentId"],
        facts=[
            AgentFact(claim=fact["claim"], evidence_id=fact["evidenceId"])
            for fact in payload["facts"]
        ],
        tools_called=payload["toolsCalled"],
    )
    validated = ClaimValidator().validate(
        response,
        known_evidence_ids=set(payload["knownEvidenceIds"]),
    )
    expectation = case["expectation"]
    failures: list[str] = []
    if validated.validation_status != expectation["validationStatus"]:
        failures.append(
            f"validation_status={validated.validation_status!r} expected={expectation['validationStatus']!r}"
        )
    remaining_evidence_ids = [fact.evidence_id for fact in validated.facts]
    if remaining_evidence_ids != expectation["remainingEvidenceIds"]:
        failures.append(
            f"remaining_evidence_ids={remaining_evidence_ids!r} expected={expectation['remainingEvidenceIds']!r}"
        )
    return failures


def _check_bad_tool_call_case(case: dict) -> list[str]:
    registry = _build_registry()
    tool_call = case["toolCall"]
    try:
        registry.call(tool_call["role"], tool_call["toolName"], "INC-2025-IKEJA-001", [])
    except ValueError:
        return [] if case["expectation"]["shouldRaise"] else ["unexpected tool rejection"]
    return ["expected disallowed tool call to raise"]


def _check_commercial_only_case(service, case: dict) -> list[str]:
    report = service.investigate(_trigger_from_case(case))
    return _check_report(report, case["expectation"])


def _check_report(report, expectation: dict) -> list[str]:
    failures: list[str] = []
    for role in expectation.get("selectedRolesInclude", []):
        if role not in report.selected_roles:
            failures.append(f"missing selected role {role}")
    for role in expectation.get("selectedRolesExclude", []):
        if role in report.selected_roles:
            failures.append(f"unexpected selected role {role}")
    required_action = expectation.get("requiredRecommendationAction")
    actions = [recommendation.action for recommendation in report.recommendations]
    if required_action is not None and required_action not in actions:
        failures.append(f"missing recommendation {required_action}")
    for action in expectation.get("forbiddenRecommendationActions", []):
        if action in actions:
            failures.append(f"forbidden recommendation {action}")
    return failures


def _trigger_from_case(case: dict) -> InvestigationTrigger:
    trigger = case["trigger"]
    return InvestigationTrigger(
        trigger_id=case["evalId"],
        lga_id=trigger["lgaId"],
        incident_id=trigger["incidentId"],
        trigger_type="threshold",
        score=trigger["score"],
        confidence=trigger["confidence"],
        time_to_breach_minutes=trigger["timeToBreachMinutes"],
        triggered_domains=trigger["triggeredDomains"],
        reason=trigger["reason"],
        created_at=datetime.now(timezone.utc),
    )


def _score_from_signal(signal: dict) -> RiskScore:
    scenario = load_demo_scenario()
    base_score = scenario.risk_score_for_lga(signal["lgaId"])
    if base_score is None:
        raise ValueError(f"No demo risk score for {signal['lgaId']!r}")
    return base_score.model_copy(
        update={
            "score": signal["score"],
            "confidence": signal["confidence"],
            "time_to_breach_minutes": signal["timeToBreachMinutes"],
        }
    )


def _feature_windows_from_signal(signal: dict) -> list[FeatureWindow]:
    scenario = load_demo_scenario()
    windows_by_domain = {window.domain: window for window in scenario.feature_windows}
    windows = []
    for feature in signal["featureWindows"]:
        window = windows_by_domain[feature["domain"]]
        windows.append(window.model_copy(update={"anomaly_score": feature["anomalyScore"]}))
    return windows


def _build_registry() -> ToolRegistry:
    risk_repo = RiskScoreRepository()
    incident_repo = IncidentRepository()
    audit_repo = AuditLogRepository()
    compliance_repo = CompliancePackRepository()
    backend = DemoCopilotToolBackend(
        risk_repo=risk_repo,
        incident_repo=incident_repo,
        audit_repo=audit_repo,
        compliance_repo=compliance_repo,
    )
    return ToolRegistry(backend)


if __name__ == "__main__":
    raise SystemExit(main())
