import unittest

from app.modules.copilot.prompts import PromptComposer, PromptContext


class PromptComposerTest(unittest.TestCase):
    def test_composes_shared_and_role_prompt_with_placeholders(self) -> None:
        prompt = PromptComposer().compose(
            "network_forensics",
            PromptContext(
                incident_id="INC-1",
                brief="Find the cause.",
                budget="2 calls",
                now_utc="2026-07-08T11:25:00+00:00",
            ),
        )

        self.assertIn("The grounding law", prompt)
        self.assertIn("Network forensics", prompt)
        self.assertIn("INC-1", prompt)
        self.assertIn("Find the cause.", prompt)
        self.assertNotIn("{{incident_id}}", prompt)
        self.assertNotIn("{{brief}}", prompt)


if __name__ == "__main__":
    unittest.main()
