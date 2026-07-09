from pathlib import Path
import argparse
import json

from app.modules.copilot.extractor import extract_agent_response
from app.modules.copilot.openrouter import (
    DEFAULT_OPENROUTER_AGENT_MODEL,
    OpenRouterAgentClient,
)
from app.modules.copilot.prompts import PromptComposer, PromptContext
from app.modules.copilot.spike import DEFAULT_SCENARIO_PATH, run_fixture_spike


DEFAULT_API_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the W0 strict-output conformance spike against scenario 1.",
    )
    parser.add_argument(
        "--scenario",
        type=Path,
        default=DEFAULT_SCENARIO_PATH,
        help="Path to an agent scenario fixture.",
    )
    parser.add_argument(
        "--transcript-dir",
        type=Path,
        default=None,
        help="Directory where the dry-run transcript should be written.",
    )
    parser.add_argument(
        "--max-tool-calls",
        type=int,
        default=2,
        help="Tool-call budget for the dry-run loop.",
    )
    parser.add_argument(
        "--live-openrouter-strict",
        action="store_true",
        help="Call OpenRouter directly with strict JSON schema response_format.",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_OPENROUTER_AGENT_MODEL,
        help="OpenRouter model id for --live-openrouter-strict.",
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=DEFAULT_API_ENV_FILE,
        help="Optional env file containing OPENROUTER_API_KEY.",
    )
    args = parser.parse_args()

    if args.live_openrouter_strict:
        result = run_openrouter_strict(
            scenario_path=args.scenario,
            transcript_dir=args.transcript_dir
            if args.transcript_dir is not None
            else Path(__file__).resolve().parents[1] / ".agent_transcripts",
            model=args.model,
            env_file=args.env_file,
            max_tool_calls=args.max_tool_calls,
        )
        print(f"run_id={result['run_id']}")
        print(f"transcript={result['transcript_path']}")
        print(f"model={result['model']}")
        print(f"validation_status={result['validation_status']}")
        print(f"facts={result['fact_count']}")
        print(f"stripped_fact_count={result['stripped_fact_count']}")
        print(f"tool_calls={result['tool_call_count']}")
        return

    result = run_fixture_spike(
        scenario_path=args.scenario,
        transcript_dir=args.transcript_dir
        if args.transcript_dir is not None
        else Path(__file__).resolve().parents[1] / ".agent_transcripts",
        max_tool_calls=args.max_tool_calls,
    )

    print(f"run_id={result.run_id}")
    print(f"transcript={result.transcript_path}")
    print(f"validation_status={result.response.validation_status}")
    print(f"facts={len(result.response.facts)}")
    print(f"tool_calls={result.tool_call_count}")
    print(f"prompt_chars={result.prompt_chars}")


def run_openrouter_strict(
    *,
    scenario_path: Path,
    transcript_dir: Path,
    model: str,
    env_file: Path | None,
    max_tool_calls: int,
) -> dict[str, object]:
    fixture = json.loads(scenario_path.read_text(encoding="utf-8"))
    incident = fixture["incident"]
    evidence = fixture["evidence"]
    evidence_by_id = {item["evidence_id"]: item for item in evidence}
    composer = PromptComposer()
    system_prompt = composer.compose(
        "network_forensics",
        PromptContext(
            incident_id=incident["incident_id"],
            brief=fixture["brief"],
            budget=f"{max_tool_calls} observed tool calls supplied; emit final JSON now",
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
        raise RuntimeError("strict OpenRouter spike exceeded the configured tool-call budget")

    user_prompt = json.dumps(
        {
            "instruction": (
                "Provider conformance spike: these observations were supplied by a fixture. "
                "Use only this data, then emit the final AgentResponse JSON object."
            ),
            "tool_observations": tool_calls,
        },
        indent=2,
    )
    completion = OpenRouterAgentClient.from_env(env_file=env_file).complete_agent_envelope(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        allowed_evidence_ids=[item["evidence_id"] for item in evidence],
    )
    extraction = extract_agent_response(
        completion.content,
        evidence_resolver=evidence_by_id.get,
    )

    transcript_dir.mkdir(parents=True, exist_ok=True)
    transcript_path = transcript_dir / f"{completion.response_id or 'openrouter-strict'}.json"
    transcript = {
        "mode": "openrouter_strict",
        "model": completion.model,
        "response_id": completion.response_id,
        "usage": completion.usage,
        "system_prompt": system_prompt,
        "user_prompt": json.loads(user_prompt),
        "raw_content": completion.content,
        "core_response": extraction.response.model_dump(mode="json"),
        "validation": {
            "status": extraction.validation.status,
            "kept_fact_count": extraction.validation.kept_fact_count,
            "stripped_fact_count": extraction.validation.stripped_fact_count,
            "issues": [
                {
                    "claim": issue.claim,
                    "evidence_id": issue.evidence_id,
                    "reason": issue.reason,
                }
                for issue in extraction.validation.issues
            ],
        },
    }
    transcript_path.write_text(json.dumps(transcript, indent=2), encoding="utf-8")

    return {
        "run_id": completion.response_id or "openrouter-strict",
        "transcript_path": transcript_path,
        "model": completion.model,
        "validation_status": extraction.response.validation_status,
        "fact_count": len(extraction.response.facts),
        "stripped_fact_count": extraction.validation.stripped_fact_count,
        "tool_call_count": len(tool_calls),
    }


if __name__ == "__main__":
    main()
