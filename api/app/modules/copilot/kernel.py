from __future__ import annotations

from app.core.config import Settings

SERVICE_ID = "azure-openai"


def build_semantic_kernel(settings: Settings):
    """Lazy Semantic Kernel bootstrap.

    We keep the import inside the function so the rest of the backend can run
    before the Semantic Kernel dependency is installed.
    """

    try:
        from semantic_kernel import Kernel
        from semantic_kernel.connectors.ai.open_ai import AzureChatCompletion
    except ImportError as exc:  # pragma: no cover - exercised after SK install
        raise RuntimeError(
            "Semantic Kernel is not installed. Add 'semantic-kernel[azure]' "
            "to the backend dependencies before enabling the live copilot runtime."
        ) from exc

    kernel = Kernel()
    kernel.add_service(
        AzureChatCompletion(
            service_id=SERVICE_ID,
            deployment_name=settings.resolved_azure_openai_deployment_name,
            api_key=settings.azure_openai_api_key,
            endpoint=settings.azure_openai_endpoint,
            api_version=settings.azure_openai_api_version,
        )
    )
    return kernel
