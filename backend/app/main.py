"""FastAPI app entry point: CORS, table creation, scheduler startup, routes."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routes import router as api_router
from .routes_auth import router as auth_router
from .routes_keys import router as keys_router
from .services.scheduler import start_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(
    title="ContentSync API",
    description="Smart multi-platform blog auto-publisher.",
    version="1.1.0",
)

# CORS allowlist:
#   - localhost / 127.0.0.1 on common Next.js dev ports
#   - settings.frontend_url  (production frontend)
#   - settings.allowed_origins  (comma-separated extras for previews, etc.)
# The list is deduped and blanks are filtered out.
_dev_origins = list(dict.fromkeys(
    o.strip()
    for o in (
        [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            settings.frontend_url,
        ]
        + [
            extra
            for extra in settings.allowed_origins.split(",")
            if extra.strip()
        ]
    )
    if o and o.strip()
))

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in _dev_origins if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables if they don't exist (Neon.tech supports DDL on first connect).
Base.metadata.create_all(bind=engine)


@app.on_event("startup")
def on_startup() -> None:
    start_scheduler()


app.include_router(api_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(keys_router, prefix="/api")