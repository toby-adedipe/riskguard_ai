from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from pydantic import BaseModel

from app.core.schemas import AgentResponse
from app.modules.copilot.extractor import (
    ClaimValidationReport,
    extract_agent_response,
)
from app.modules.copilot.prompts import PromptComposer, PromptContext


DEFAULT_SCENARIO_PATH = (
    Path(__file__).resolve().parents[2]
    / "demo_data"
    / "agent_scenarios"
    / "ikeja_fibre_cut.json"
)
DEFAULT_TRANSCRIPT_DIR = Path(__file__).resolve().parents[3] / ".agent_transcripts"


@dataclass(frozen=True)
class SpikeResult:
    run_id: str
    transcript_path: Path
    response: AgentResponse
    validation: ClaimValidationReport
    prompt_chars: int
    tool_call_count: int


def run_fixture_spike(
    scenario_path: Path = DEFAULT_SCENARIO_PATH,
    transcript_dir: Path = DEFAULT_TRANSCRIPT_DIR,
    max_tool_calls: int = 2,
) -> SpikeResult:
    """Run the W0 integration spike without requiring a live model provider."""

    fixture = json.loads(scenario_path.read_text(encoding="utf-8"))
    incident = fixture["incident"]
    evidence = fixture["evidence"]
    evidence_by_id = {item["evidence_id"]: item for item in evidence}

    def resolve_evidence(evidence_id: str) -> Any | None:
        return evidence_by_id.get(evidence_id)

    composer = PromptComposer()
    prompt = composer.compose(
        "network_forensics",
        PromptContext(
            incident_id=incident["incident_id"],
            brief=fixture["brief"],
            budget=f"{max_tool_calls} tool calls, 2 iterations, dry-run spike",
            now_utc=fixture["now_utc"],
        ),
    )

    tool_calls = [
        {
            "tool": "get_incident_context",
            "args": {"incident_id": incident["incident_id"]},
            "observation": incident,
        },
        {
            "tool": "list_evidence",
            "args": {"lga_id": incident["lga_id"], "limit": len(evidence)},
            "observation": evidence,
        },
    ]
    if len(tool_calls) > max_tool_calls:
        raise RuntimeError("dry-run spike exceeded the configured tool-call budget")

    raw_final_output = json.dumps(fixture["agent_final_output"])
    extraction = extract_agent_response(raw_final_output, evidence_resolver=resolve_evidence)

    run_id = f"W0-{uuid4()}"
    transcript = _json_safe(
        {
            "run_id": run_id,
            "mode": "dry_run",
            "harness": "pi-spike-dry-run",
            "created_at": datetime.now(timezone.utc),
            "scenario_id": fixture["scenario_id"],
            "criteria": {
                "tool_loop_iterated": len(tool_calls) >= 2,
                "transcript_persisted": True,
                "budget_enforced": len(tool_calls) <= max_tool_calls,
                "structured_output_extracted": extraction.response.validation_status
                in {"passed", "revised", "rejected"},
            },
            "system_prompt": prompt,
            "tool_calls": tool_calls,
            "final_output": fixture["agent_final_output"],
            "core_response": extraction.response,
            "validation": extraction.validation,
        }
    )

    transcript_dir.mkdir(parents=True, exist_ok=True)
    transcript_path = transcript_dir / f"{run_id}.json"
    transcript_path.write_text(json.dumps(transcript, indent=2), encoding="utf-8")

    return SpikeResult(
        run_id=run_id,
        transcript_path=transcript_path,
        response=extraction.response,
        validation=extraction.validation,
        prompt_chars=len(prompt),
        tool_call_count=len(tool_calls),
    )


def _json_safe(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, ClaimValidationReport):
        return {
            "status": value.status,
            "issues": [_json_safe(issue) for issue in value.issues],
            "kept_fact_count": value.kept_fact_count,
            "stripped_fact_count": value.stripped_fact_count,
        }
    if hasattr(value, "__dataclass_fields__"):
        return {
            key: _json_safe(getattr(value, key))
            for key in value.__dataclass_fields__
        }
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_json_safe(item) for item in value]
    return value
