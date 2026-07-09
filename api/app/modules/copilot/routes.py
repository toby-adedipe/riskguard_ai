from fastapi import APIRouter, HTTPException, status

from app.modules.copilot.schemas import CopilotQueryRequest, CopilotRuntimeStatus


router = APIRouter(prefix="/copilot", tags=["copilot"])


@router.get("/status", response_model=CopilotRuntimeStatus)
def runtime_status() -> CopilotRuntimeStatus:
    return CopilotRuntimeStatus()


@router.post("/query")
def query(_request: CopilotQueryRequest) -> None:
    """Preserve the public seam without pretending W0 is an interactive runtime."""

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "The interactive agent runtime is intentionally offline. "
            "W0 currently validates prompts, strict provider output, extraction, "
            "and grounded-claim handling through the spike CLI and tests."
        ),
    )
