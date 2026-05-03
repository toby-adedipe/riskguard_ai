from __future__ import annotations

import json
from pathlib import Path

from app.core.config import get_settings
from app.modules.audit.db import AuditLogRepository
from app.modules.compliance.db import CompliancePackRepository
from app.modules.copilot.db import InvestigationRunRepository
from app.modules.copilot.schemas import CopilotQueryRequest
from app.modules.copilot.services import CopilotService
from app.modules.incidents.db import IncidentRepository
from app.modules.risk.db import RiskScoreRepository


def build_live_service() -> CopilotService:
    risk_repo = RiskScoreRepository()
    incident_repo = IncidentRepository()
    audit_repo = AuditLogRepository()
    compliance_repo = CompliancePackRepository()
    run_repo = InvestigationRunRepository()

    settings = get_settings()
    if not settings.azure_openai_configured:
        raise RuntimeError("Azure OpenAI settings are not configured in api/.env.")

    return CopilotService(
        risk_repo=risk_repo,
        incident_repo=incident_repo,
        audit_repo=audit_repo,
        compliance_repo=compliance_repo,
        run_repo=run_repo,
    )


def main() -> int:
    eval_path = Path(__file__).with_name("eval-source-copilot-agent-capabilities.jsonl")
    if not eval_path.exists():
        raise FileNotFoundError(f"Missing eval slice: {eval_path}")

    with eval_path.open("r", encoding="utf-8") as handle:
        cases = [json.loads(line) for line in handle if line.strip()]

    service = build_live_service()
    failures: list[str] = []
    try:
        for case in cases:
            request = CopilotQueryRequest(
                role=case["role"],
                incident_id=case["incidentId"],
                query=case["prompt"],
            )
            response = service.query(request)
            expectation = case["expectation"]

            case_failures: list[str] = []
            if response.validation_status != expectation["validationStatus"]:
                case_failures.append(
                    f"validation_status={response.validation_status!r} expected={expectation['validationStatus']!r}"
                )
            if len(response.facts) < expectation["minFactCount"]:
                case_failures.append(
                    f"fact_count={len(response.facts)} expected>={expectation['minFactCount']}"
                )
            for tool_name in expectation["toolsInclude"]:
                if tool_name not in response.tools_called:
                    case_failures.append(f"missing tool call {tool_name}")

            required_action = expectation.get("requiredRecommendationAction")
            if required_action is not None and required_action not in {
                recommendation.action for recommendation in response.recommendations
            }:
                case_failures.append(f"missing recommendation {required_action}")

            if case_failures:
                failures.append(f"{case['evalId']}: " + "; ".join(case_failures))
                status = "FAIL"
            else:
                status = "PASS"

            print(
                f"[{status}] {case['evalId']} role={case['role']} "
                f"tools={response.tools_called} "
                f"facts={len(response.facts)} recommendations="
                f"{[recommendation.action for recommendation in response.recommendations]}"
            )
    finally:
        service.close()

    if failures:
        print("\nFailures:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print(f"\nAll {len(cases)} live copilot evals passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
