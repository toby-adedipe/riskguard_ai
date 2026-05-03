from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

from app.core.schemas import InvestigationTrigger
from tests.modules.copilot.fixtures import build_seeded_agent


class CopilotHarnessEvalSliceTestCase(unittest.TestCase):
    def test_harness_eval_slice_cases(self) -> None:
        agent, _ = build_seeded_agent()
        eval_path = (
            Path(__file__).resolve().parents[3]
            / "evals"
            / "eval-source-copilot-harness.jsonl"
        )
        self.assertTrue(eval_path.exists(), f"Missing eval slice: {eval_path}")

        with eval_path.open("r", encoding="utf-8") as handle:
            cases = [json.loads(line) for line in handle if line.strip()]

        self.assertGreaterEqual(len(cases), 5)

        for case in cases:
            with self.subTest(eval_id=case["evalId"]):
                report = agent.run_harness(self._trigger_from_case(case))
                expectation = case["expectation"]

                self.assertEqual(report.status, expectation["status"])

                for role in expectation.get("selectedRolesInclude", []):
                    self.assertIn(role, report.selected_roles)

                for role in expectation.get("selectedRolesExclude", []):
                    self.assertNotIn(role, report.selected_roles)

                step_ids = [step.step_id for step in report.steps]
                expected_step_order = expectation.get("stepOrderIncludes", [])
                if expected_step_order:
                    self.assertEqual(
                        [step_id for step_id in step_ids if step_id in expected_step_order],
                        expected_step_order,
                    )

                for tool_name in expectation.get("toolsInclude", []):
                    self.assertIn(tool_name, report.tools_called)

                self.assertGreaterEqual(
                    len(report.evidence_ids),
                    expectation.get("minEvidenceIds", 0),
                )

                required_action = expectation.get("requiredRecommendationAction")
                if required_action is not None:
                    self.assertIn(
                        required_action,
                        [recommendation.action for recommendation in report.recommendations],
                    )

                forbidden_actions = expectation.get("forbiddenRecommendationActions", [])
                for action in forbidden_actions:
                    self.assertNotIn(
                        action,
                        [recommendation.action for recommendation in report.recommendations],
                    )

                expected_validation = expectation.get("allAgentStepsValidationStatus")
                if expected_validation is not None:
                    for step in report.steps:
                        if step.kind == "run_agent":
                            self.assertEqual(step.validation_status, expected_validation)

    @staticmethod
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


if __name__ == "__main__":
    unittest.main()
