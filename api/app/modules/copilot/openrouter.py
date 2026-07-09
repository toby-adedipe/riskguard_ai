from __future__ import annotations

from dataclasses import dataclass
import json
import os
import ssl
from pathlib import Path
from typing import Any, Sequence, get_args
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.modules.copilot.schemas import AgentRuntimeRole


OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_OPENROUTER_AGENT_MODEL = "moonshotai/kimi-k2.7-code"


class OpenRouterConfigurationError(RuntimeError):
    """Raised when the OpenRouter client cannot be configured safely."""


class OpenRouterRequestError(RuntimeError):
    """Raised when OpenRouter rejects or fails a completion request."""


@dataclass(frozen=True)
class OpenRouterCompletion:
    response_id: str | None
    model: str
    content: str
    usage: dict[str, Any]
    raw_response: dict[str, Any]


def strict_agent_envelope_response_format(
    allowed_evidence_ids: Sequence[str] | None = None,
) -> dict[str, Any]:
    """OpenRouter response_format that constrains final agent output shape."""

    evidence_id_property: dict[str, Any] = {"type": "string"}
    if allowed_evidence_ids is not None:
        evidence_id_property["enum"] = list(dict.fromkeys(allowed_evidence_ids))

    return {
        "type": "json_schema",
        "json_schema": {
            "name": "agent_envelope",
            "strict": True,
            "schema": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "agent_role",
                    "incident_id",
                    "narrative",
                    "facts",
                    "inferences",
                    "recommendations",
                    "open_questions",
                    "assumptions",
                    "tools_called",
                ],
                "properties": {
                    "agent_role": {
                        "type": "string",
                        "enum": list(get_args(AgentRuntimeRole)),
                    },
                    "incident_id": {"type": "string"},
                    "narrative": {"type": "string"},
                    "facts": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["claim", "evidence_id"],
                            "properties": {
                                "claim": {"type": "string"},
                                "evidence_id": evidence_id_property,
                            },
                        },
                    },
                    "inferences": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["claim", "confidence"],
                            "properties": {
                                "claim": {"type": "string"},
                                "confidence": {
                                    "type": "number",
                                    "minimum": 0,
                                    "maximum": 1,
                                },
                            },
                        },
                    },
                    "recommendations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["action", "requires_approval"],
                            "properties": {
                                "action": {"type": "string"},
                                "requires_approval": {"type": "boolean"},
                            },
                        },
                    },
                    "open_questions": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "assumptions": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "tools_called": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
            },
        },
    }


class OpenRouterAgentClient:
    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = OPENROUTER_CHAT_COMPLETIONS_URL,
        timeout_seconds: int = 120,
        app_title: str = "RiskGuard AI",
    ) -> None:
        if not api_key:
            raise OpenRouterConfigurationError("OPENROUTER_API_KEY is required")
        self._api_key = api_key
        self._base_url = base_url
        self._timeout_seconds = timeout_seconds
        self._app_title = app_title

    @classmethod
    def from_env(
        cls,
        *,
        env_file: Path | None = None,
        timeout_seconds: int = 120,
    ) -> "OpenRouterAgentClient":
        return cls(
            load_openrouter_api_key(env_file=env_file),
            timeout_seconds=timeout_seconds,
        )

    def complete_agent_envelope(
        self,
        *,
        model: str = DEFAULT_OPENROUTER_AGENT_MODEL,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0,
        max_tokens: int = 4096,
        allowed_evidence_ids: Sequence[str] | None = None,
    ) -> OpenRouterCompletion:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": strict_agent_envelope_response_format(
                allowed_evidence_ids=allowed_evidence_ids,
            ),
            "provider": {"require_parameters": True},
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        response = self._post(payload)
        choices = response.get("choices")
        if not choices:
            raise OpenRouterRequestError("OpenRouter response did not include choices")
        message = choices[0].get("message") or {}
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise OpenRouterRequestError("OpenRouter response did not include text content")
        return OpenRouterCompletion(
            response_id=response.get("id"),
            model=str(response.get("model") or model),
            content=content,
            usage=response.get("usage") or {},
            raw_response=response,
        )

    def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        request = Request(
            self._base_url,
            data=body,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
                "X-OpenRouter-Title": self._app_title,
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                raw = response.read().decode("utf-8")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise OpenRouterRequestError(
                f"OpenRouter returned HTTP {exc.code}: {detail}"
            ) from exc
        except URLError as exc:
            raise OpenRouterRequestError(f"OpenRouter request failed: {exc}") from exc
        except ssl.SSLError as exc:
            raise OpenRouterRequestError(f"OpenRouter TLS request failed: {exc}") from exc

        try:
            loaded = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise OpenRouterRequestError("OpenRouter returned non-JSON response") from exc
        if not isinstance(loaded, dict):
            raise OpenRouterRequestError("OpenRouter returned unexpected response shape")
        return loaded


def load_openrouter_api_key(env_file: Path | None = None) -> str:
    env_key = os.environ.get("OPENROUTER_API_KEY")
    if env_key:
        return env_key
    if env_file is not None and env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if stripped.startswith("OPENROUTER_API_KEY="):
                return stripped.split("=", 1)[1].strip().strip("'\"")
    raise OpenRouterConfigurationError("OPENROUTER_API_KEY is not set")
