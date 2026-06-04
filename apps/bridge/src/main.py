import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import health


def create_app() -> FastAPI:
    app = FastAPI(title="AMRDetail Bridge", version="0.1.0")

    origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, tags=["system"])
    return app


app = create_app()
