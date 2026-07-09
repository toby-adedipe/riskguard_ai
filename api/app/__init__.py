from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.modules.actions.routes import router as actions_router
from app.modules.compliance.routes import router as compliance_router
from app.modules.copilot.routes import router as copilot_router
from app.modules.incidents.routes import router as incidents_router
from app.modules.ingestion.routes import router as ingestion_router
from app.modules.risk.routes import router as risk_router
from app.modules.risk.db import get_risk_repo
from app.modules.incidents.db import get_incident_repo
from app.modules.simulation.db import get_simulation_repo
from app.modules.simulation.services import SimulationService
from app.modules.simulation.routes import router as simulation_router


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        SimulationService(
            repo=get_simulation_repo(),
            risk_repo=get_risk_repo(),
            incident_repo=get_incident_repo(),
        ).start()
        yield

    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(simulation_router)
    app.include_router(ingestion_router)
    app.include_router(risk_router)
    app.include_router(incidents_router)
    app.include_router(copilot_router)
    app.include_router(actions_router)
    app.include_router(compliance_router)

    return app
