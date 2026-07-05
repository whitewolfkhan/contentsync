"""SQLAlchemy database engine, session, and Base."""
import logging
import os
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

logger = logging.getLogger(__name__)


def _normalize_url(url: str | None) -> str:
    """Force the psycopg (v3) driver and add sslmode=require for cloud Postgres.

    Accepts ``postgresql://``, ``postgres://``, ``postgresql+psycopg://``,
    ``postgresql+psycopg2://``, etc. and rewrites any non-psycopg-v3 form to
    ``postgresql+psycopg://``. Also appends ``sslmode=require`` if it's not
    already present so Neon / Render Postgres / Supabase always negotiate SSL.
    """
    if not url:
        return url  # type: ignore[return-value]

    parts = urlsplit(url)
    scheme = parts.scheme
    if scheme in ("postgresql+psycopg2", "postgresql+pg8000", "postgresql+asyncpg"):
        new_scheme = "postgresql+psycopg"
    elif scheme in ("postgresql", "postgres", "postgresql+psycopg"):
        new_scheme = "postgresql+psycopg"
    else:
        new_scheme = scheme

    # Preserve any existing query params, but force sslmode=require when missing.
    query = parse_qs(parts.query, keep_blank_values=True)
    if "sslmode" not in query:
        query["sslmode"] = ["require"]
    new_query = urlencode(query, doseq=True)
    new_url = urlunsplit((new_scheme, parts.netloc, parts.path, new_query, parts.fragment))

    if new_url != url:
        logger.info("Normalized DATABASE_URL (driver/SSL adjustments applied)")
    return new_url


def _resolve_database_url() -> str:
    """Read DATABASE_URL with a clear error when it's missing or still the local default.

    On Render, ``render.yaml`` declares ``DATABASE_URL`` with ``sync: false``, so
    the value must be supplied manually in the dashboard. If we fall through to
    the local default, we raise a loud error so this never silently boots against
    ``localhost:5432`` in production again.
    """
    url = os.getenv("DATABASE_URL") or settings.database_url
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Add it in your Render dashboard under "
            "Environment (or set it in your local .env)."
        )
    if "localhost" in url or url.startswith("postgresql+psycopg://postgres:postgres@localhost"):
        # Only allow the local default when running on a developer machine.
        if os.getenv("RENDER") or os.getenv("RENDER_SERVICE_NAME"):
            raise RuntimeError(
                "DATABASE_URL is still the local default "
                f"({url[:60]}...). Set the real Neon connection string in the "
                "Render dashboard → Environment → DATABASE_URL, then redeploy."
            )
        logger.warning(
            "DATABASE_URL is the local default; fine for local dev but must be "
            "overridden in production."
        )
    return url


engine = create_engine(
    _normalize_url(_resolve_database_url()), pool_pre_ping=True, future=True
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
