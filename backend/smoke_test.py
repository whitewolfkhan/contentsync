"""Smoke test: confirm SQLAlchemy can reach the local PostgreSQL."""
import os, sys

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg2://contentsync:Khanali@localhost:5432/contentsync",
)

try:
    from sqlalchemy import create_engine, text
except Exception as exc:  # noqa: BLE001
    print("IMPORT_FAIL", exc)
    sys.exit(1)

engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
try:
    with engine.connect() as conn:
        db, user = conn.execute(
            text("SELECT current_database(), current_user")
        ).first()
        print(f"CONNECT_OK db={db} user={user}")
except Exception as exc:  # noqa: BLE001
    print("CONNECT_FAIL", exc)
    sys.exit(1)
