import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import health, maps


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect the Prisma client used by the map service. Guarded so unit tests
    # (which override the dependency and may run without a generated client) and
    # environments without a DB don't crash on startup.
    svc = maps.get_map_service()
    try:
        await svc.db.connect()
    except Exception as exc:  # pragma: no cover - startup connectivity is env-specific
        print(f"[bridge] prisma connect skipped: {exc}")
    yield
    try:
        await svc.db.disconnect()
    except Exception:  # pragma: no cover
        pass


def create_app() -> FastAPI:
    app = FastAPI(title="AMRDetail Bridge", version="0.1.0", lifespan=lifespan)

    origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, tags=["system"])
    app.include_router(maps.router)
    return app


app = create_app()
