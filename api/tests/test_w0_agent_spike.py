from pathlib import Path
import tempfile
import unittest

from app.modules.copilot.spike import DEFAULT_SCENARIO_PATH, run_fixture_spike


class W0AgentSpikeTest(unittest.TestCase):
    def test_dry_run_spike_persists_transcript_and_extracts_response(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            result = run_fixture_spike(
                scenario_path=DEFAULT_SCENARIO_PATH,
                transcript_dir=Path(temp_dir),
            )

            self.assertTrue(result.transcript_path.exists())
            self.assertEqual(result.response.validation_status, "passed")
            self.assertEqual(result.tool_call_count, 2)
            self.assertGreater(result.prompt_chars, 1000)

    def test_dry_run_spike_enforces_tool_budget(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(RuntimeError):
                run_fixture_spike(
                    scenario_path=DEFAULT_SCENARIO_PATH,
                    transcript_dir=Path(temp_dir),
                    max_tool_calls=1,
                )


if __name__ == "__main__":
    unittest.main()
