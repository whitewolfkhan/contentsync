"""SQLAlchemy database engine, session, and Base."""
import re

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings


def _normalize_url(url: str) -> str:
    """Force the psycopg (v3) driver so SQLAlchemy never tries to import psycopg2.

    Accepts `postgresql://`, `postgres://`, `postgresql+psycopg://`,
    `postgresql+psycopg2://`, etc. and rewrites any of the non-psycopg-v3 forms
    to `postgresql+psycopg://`. This keeps Render env vars (which usually
    arrive as plain `postgresql://` from Neon) working without any rewrites.
    """
    if not url:
        return url
    # Strip any existing driver suffix so we can rebuild the URL consistently.
    scheme = re.split(r"[:@]", url, 1)[0]
    rest = url[len(scheme) + 1 :]  # everything after "scheme:"
    if scheme in ("postgresql+psycopg2", "postgresql+pg8000", "postgresql+asyncpg"):
        # Replace explicitly-pinned old drivers with the v3 one.
        return f"postgresql+psycopg://{rest}"
    if scheme in ("postgresql", "postgres", "postgresql+psycopg"):
        return f"postgresql+psycopg://{rest}"
    return url


engine = create_engine(
    _normalize_url(settings.database_url), pool_pre_ping=True, future=True
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
