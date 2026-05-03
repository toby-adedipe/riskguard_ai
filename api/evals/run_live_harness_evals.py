from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from app.core.schemas import InvestigationTrigger
from evals.run_live_copilot_evals import build_live_service


def main() -> int:
    parser = argparse.ArgumentParser(description="Run live wake-on-signal harness evals.")
    parser.add_argument("--limit", type=int, default=None, help="Run only the first N cases.")
    args = parser.parse_args()

    eval_path = Path(__file__).with_name("eval-source-copilot-harness.jsonl")
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
            report = service.investigate(_trigger_from_case(case))
            expectation = case["expectation"]
            case_failures = _check_report(report, expectation)
            if case_failures:
                failures.append(f"{case['evalId']}: " + "; ".join(case_failures))
                status = "FAIL"
            else:
                status = "PASS"
            print(
                f"[{status}] {case['evalId']} "
                f"roles={report.selected_roles} "
                f"steps={len(report.steps)} "
                f"tools={len(report.tools_called)} "
                f"recommendations={[recommendation.action for recommendation in report.recommendations]}"
            )
    finally:
        service.close()

    if failures:
        print("\nFailures:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print(f"\nAll {len(cases)} live harness evals passed.")
    return 0


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


def _check_report(report, expectation: dict) -> list[str]:
    failures: list[str] = []
    if report.status != expectation["status"]:
        failures.append(f"status={report.status!r} expected={expectation['status']!r}")

    for role in expectation.get("selectedRolesInclude", []):
        if role not in report.selected_roles:
            failures.append(f"missing selected role {role}")

    for role in expectation.get("selectedRolesExclude", []):
        if role in report.selected_roles:
            failures.append(f"unexpected selected role {role}")

    step_ids = [step.step_id for step in report.steps]
    expected_step_order = expectation.get("stepOrderIncludes", [])
    if expected_step_order:
        actual_order = [step_id for step_id in step_ids if step_id in expected_step_order]
        if actual_order != expected_step_order:
            failures.append(f"step order {actual_order!r} expected {expected_step_order!r}")

    for tool_name in expectation.get("toolsInclude", []):
        if tool_name not in report.tools_called:
            failures.append(f"missing tool call {tool_name}")

    min_evidence_ids = expectation.get("minEvidenceIds", 0)
    if len(report.evidence_ids) < min_evidence_ids:
        failures.append(f"evidence count {len(report.evidence_ids)} expected >= {min_evidence_ids}")

    required_action = expectation.get("requiredRecommendationAction")
    recommendation_actions = [recommendation.action for recommendation in report.recommendations]
    if required_action is not None and required_action not in recommendation_actions:
        failures.append(f"missing recommendation {required_action}")

    for action in expectation.get("forbiddenRecommendationActions", []):
        if action in recommendation_actions:
            failures.append(f"forbidden recommendation {action}")

    expected_validation = expectation.get("allAgentStepsValidationStatus")
    if expected_validation is not None:
        for step in report.steps:
            if step.kind == "run_agent" and step.validation_status != expected_validation:
                failures.append(
                    f"{step.step_id} validation_status={step.validation_status!r} "
                    f"expected={expected_validation!r}"
                )

    return failures


if __name__ == "__main__":
    raise SystemExit(main())
