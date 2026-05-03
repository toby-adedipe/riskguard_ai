from __future__ import annotations

from app.modules.copilot.tool_contracts import (
    CopilotToolBackend,
    ROLE_ALLOWED_TOOLS,
    ToolName,
)


class ToolRegistry:
    def __init__(self, backend: CopilotToolBackend) -> None:
        self._backend = backend

    def call(self, role: str, tool_name: ToolName, /, *args, **kwargs):
        allowed_tools = ROLE_ALLOWED_TOOLS.get(role, ())
        if tool_name not in allowed_tools:
            raise ValueError(f"Tool '{tool_name}' is not allowed for role '{role}'.")
        tool = getattr(self._backend, tool_name)
        return tool(*args, **kwargs)
