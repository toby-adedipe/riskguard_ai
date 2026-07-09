import json
from pathlib import Path
import unittest

from app.modules.copilot.extractor import (
    AgentOutputParseError,
    extract_agent_response,
)


FIXTURE_PATH = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "demo_data"
    / "agent_scenarios"
    / "ikeja_fibre_cut.json"
)


class AgentExtractorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        self.evidence_by_id = {
            item["evidence_id"]: item for item in self.fixture["evidence"]
        }

    def test_extracts_fixture_envelope_to_core_response(self) -> None:
        result = extract_agent_response(
            json.dumps(self.fixture["agent_final_output"]),
            evidence_resolver=self.evidence_by_id.get,
        )

        self.assertEqual(result.response.agent_role, "network_forensics")
        self.assertEqual(result.response.incident_id, "INC-2026-IKEJA-001")
        self.assertEqual(result.response.validation_status, "passed")
        self.assertEqual(len(result.response.facts), 3)
        self.assertEqual(result.response.tools_called, ["get_incident_context", "list_evidence"])

    def test_strips_unresolved_fact_and_marks_revised(self) -> None:
        output = dict(self.fixture["agent_final_output"])
        output["facts"] = [
            *output["facts"],
            {"claim": "unresolved evidence showed 12.3", "evidence_id": "EV-MISSING"},
        ]

        result = extract_agent_response(
            json.dumps(output),
            evidence_resolver=self.evidence_by_id.get,
        )

        self.assertEqual(result.response.validation_status, "revised")
        self.assertEqual(len(result.response.facts), 3)
        self.assertEqual(result.validation.stripped_fact_count, 1)

    def test_rejects_when_all_claim_numbers_mismatch(self) -> None:
        output = dict(self.fixture["agent_final_output"])
        output["facts"] = [
            {
                "claim": "cell_availability_pct fell from 99.1 to 44.4 in Ikeja",
                "evidence_id": "EV-IKEJA-NET-001",
            }
        ]

        result = extract_agent_response(
            json.dumps(output),
            evidence_resolver=self.evidence_by_id.get,
        )

        self.assertEqual(result.response.validation_status, "rejected")
        self.assertEqual(result.response.facts, [])
        self.assertEqual(result.response.inferences, [])
        self.assertEqual(result.response.recommendations, [])

    def test_parse_error_for_non_json_output(self) -> None:
        with self.assertRaises(AgentOutputParseError):
            extract_agent_response("not-json")


if __name__ == "__main__":
    unittest.main()
