from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import re

from app.modules.copilot.schemas import AgentRuntimeRole


AGENT_PROMPT_FILES: dict[AgentRuntimeRole, str] = {
    "orchestrator": "orchestrator.md",
    "network_forensics": "network-forensics.md",
    "impact_exposure": "impact-exposure.md",
    "mitigation_planner": "mitigation-planner.md",
    "compliance_officer": "compliance-officer.md",
    "critic": "critic.md",
}

DEFAULT_AGENT_PROMPT_DIR = Path(__file__).resolve().parents[4] / "docs" / "agents"
PLACEHOLDER_RE = re.compile(r"{{\s*(?P<name>[a-zA-Z_][a-zA-Z0-9_]*)\s*}}")


@dataclass(frozen=True)
class PromptContext:
    incident_id: str
    sector: str = "telecom"
    regulator: str = "NCC"
    currency: str = "NGN"
    brief: str = ""
    budget: str = "12 tool calls, 8 iterations, 120 seconds"
    now_utc: str | None = None

    def values(self) -> dict[str, str]:
        now_utc = self.now_utc
        if now_utc is None:
            now_utc = datetime.now(timezone.utc).isoformat()
        return {
            "incident_id": self.incident_id,
            "sector": self.sector,
            "regulator": self.regulator,
            "currency": self.currency,
            "brief": self.brief,
            "budget": self.budget,
            "now_utc": now_utc,
        }


class PromptComposer:
    """Loads shared + role prompts exactly as versioned in docs/agents."""

    def __init__(self, prompt_dir: Path = DEFAULT_AGENT_PROMPT_DIR) -> None:
        self._prompt_dir = prompt_dir

    def compose(self, role: AgentRuntimeRole, context: PromptContext) -> str:
        shared = self._read("_shared.md")
        role_prompt = self._read(AGENT_PROMPT_FILES[role])
        return self.render(f"{shared.rstrip()}\n\n{role_prompt.lstrip()}", context)

    def render(self, prompt: str, context: PromptContext) -> str:
        values = context.values()

        def replace(match: re.Match[str]) -> str:
            name = match.group("name")
            if name not in values:
                return match.group(0)
            return values[name]

        return PLACEHOLDER_RE.sub(replace, prompt)

    def _read(self, filename: str) -> str:
        path = self._prompt_dir / filename
        return path.read_text(encoding="utf-8")
