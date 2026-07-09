import unittest

from fastapi import HTTPException

from app import create_app
from app.modules.copilot.routes import query, runtime_status
from app.modules.copilot.schemas import CopilotQueryRequest


class RuntimeBoundaryTest(unittest.TestCase):
    def test_public_routes_expose_status_but_not_retired_runtime(self) -> None:
        paths = {route.path for route in create_app().routes}

        self.assertIn("/copilot/status", paths)
        self.assertIn("/copilot/query", paths)
        self.assertNotIn("/copilot/investigate", paths)
        self.assertNotIn("/simulation/events", paths)
        self.assertNotIn("/simulation/mitigate", paths)

    def test_status_is_explicit_about_w0_capabilities(self) -> None:
        status = runtime_status()

        self.assertEqual(status.stage, "w0_spike")
        self.assertFalse(status.interactive_runtime)
        self.assertIn("response_extraction", status.verified_capabilities)
        self.assertIn("model_tool_loop", status.pending_capabilities)

    def test_query_fails_closed_until_interactive_runtime_exists(self) -> None:
        request = CopilotQueryRequest(
            role="network_risk",
            incident_id="INC-2026-IKEJA-001",
            query="What caused the incident?",
        )

        with self.assertRaises(HTTPException) as raised:
            query(request)

        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("intentionally offline", str(raised.exception.detail))


if __name__ == "__main__":
    unittest.main()
