import json
from unittest.mock import patch
import unittest

from app.modules.copilot.extractor import extract_agent_response
from app.modules.copilot.openrouter import (
    DEFAULT_OPENROUTER_AGENT_MODEL,
    OpenRouterAgentClient,
    strict_agent_envelope_response_format,
)


class FakeResponse:
    def __init__(self, body: dict[str, object]) -> None:
        self._body = json.dumps(body).encode("utf-8")

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return self._body


class OpenRouterStrictOutputTest(unittest.TestCase):
    def test_schema_is_strict_and_closed(self) -> None:
        response_format = strict_agent_envelope_response_format(["EV-1", "EV-2"])

        self.assertEqual(response_format["type"], "json_schema")
        self.assertTrue(response_format["json_schema"]["strict"])
        schema = response_format["json_schema"]["schema"]
        self.assertFalse(schema["additionalProperties"])
        self.assertIn("facts", schema["required"])
        self.assertFalse(schema["properties"]["facts"]["items"]["additionalProperties"])
        evidence_id = schema["properties"]["facts"]["items"]["properties"]["evidence_id"]
        self.assertEqual(evidence_id["enum"], ["EV-1", "EV-2"])

    def test_client_sends_strict_schema_and_provider_requirement(self) -> None:
        content = json.dumps(
            {
                "agent_role": "network_forensics",
                "incident_id": "INC-1",
                "narrative": "Grounded narrative.",
                "facts": [
                    {"claim": "availability was 71.4", "evidence_id": "EV-1"}
                ],
                "inferences": [{"claim": "transport issue", "confidence": 0.8}],
                "recommendations": [
                    {"action": "review reroute", "requires_approval": True}
                ],
                "open_questions": [],
                "assumptions": [],
                "tools_called": ["list_evidence"],
            }
        )
        fake_body = {
            "id": "gen-test",
            "model": DEFAULT_OPENROUTER_AGENT_MODEL,
            "choices": [{"message": {"content": content}}],
            "usage": {"total_tokens": 123},
        }

        captured: dict[str, object] = {}

        def fake_urlopen(request, timeout: int):  # type: ignore[no-untyped-def]
            captured["payload"] = json.loads(request.data.decode("utf-8"))
            captured["timeout"] = timeout
            return FakeResponse(fake_body)

        with patch("app.modules.copilot.openrouter.urlopen", side_effect=fake_urlopen):
            completion = OpenRouterAgentClient(
                "test-key",
                timeout_seconds=7,
            ).complete_agent_envelope(
                system_prompt="system",
                user_prompt="user",
                allowed_evidence_ids=["EV-1"],
            )

        payload = captured["payload"]
        self.assertEqual(payload["model"], DEFAULT_OPENROUTER_AGENT_MODEL)
        self.assertEqual(payload["response_format"]["type"], "json_schema")
        self.assertTrue(payload["response_format"]["json_schema"]["strict"])
        evidence_id = payload["response_format"]["json_schema"]["schema"]["properties"][
            "facts"
        ]["items"]["properties"]["evidence_id"]
        self.assertEqual(evidence_id["enum"], ["EV-1"])
        self.assertEqual(payload["provider"], {"require_parameters": True})
        self.assertEqual(captured["timeout"], 7)
        self.assertEqual(completion.content, content)

        result = extract_agent_response(
            completion.content,
            evidence_resolver=lambda evidence_id: {"current_value": 71.4}
            if evidence_id == "EV-1"
            else None,
        )
        self.assertEqual(result.response.validation_status, "passed")


if __name__ == "__main__":
    unittest.main()
