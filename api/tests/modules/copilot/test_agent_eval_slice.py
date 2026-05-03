from __future__ import annotations

import json
import unittest
from pathlib import Path

from app.modules.copilot.schemas import CopilotQueryRequest
from tests.modules.copilot.fixtures import build_seeded_agent


class CopilotAgentEvalSliceTestCase(unittest.TestCase):
    def test_eval_slice_cases(self) -> None:
        agent, _ = build_seeded_agent()
        eval_path = (
            Path(__file__).resolve().parents[3]
            / "evals"
            / "eval-source-copilot-agent-capabilities.jsonl"
        )
        self.assertTrue(eval_path.exists(), f"Missing eval slice: {eval_path}")

        with eval_path.open("r", encoding="utf-8") as handle:
            cases = [json.loads(line) for line in handle if line.strip()]

        self.assertGreaterEqual(len(cases), 10)

        for case in cases:
            with self.subTest(eval_id=case["evalId"]):
                request = CopilotQueryRequest(
                    role=case["role"],
                    incident_id=case["incidentId"],
                    query=case["prompt"],
                )
                response = agent.query_role(request)
                expectation = case["expectation"]

                self.assertEqual(response.validation_status, expectation["validationStatus"])
                self.assertGreaterEqual(len(response.facts), expectation["minFactCount"])

                for tool_name in expectation["toolsInclude"]:
                    self.assertIn(tool_name, response.tools_called)

                required_action = expectation.get("requiredRecommendationAction")
                if required_action is not None:
                    self.assertIn(
                        required_action,
                        [recommendation.action for recommendation in response.recommendations],
                    )


if __name__ == "__main__":
    unittest.main()
