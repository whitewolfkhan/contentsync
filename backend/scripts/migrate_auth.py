"""One-shot migration: add users, platform_keys, posts.user_id.

Safe to re-run; uses IF NOT EXISTS / information_schema guards.
"""
import psycopg

DSN = "postgresql://contentsync:Khanali@localhost:5432/contentsync"

MIGRATION_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

CREATE TABLE IF NOT EXISTS platform_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(30) NOT NULL,
    extra_id VARCHAR(255),
    secret_value TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_platform_keys_user_id ON platform_keys(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_platform ON platform_keys(user_id, platform);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'posts' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE posts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS ix_posts_user_id ON posts(user_id);
    END IF;
END
$$;
"""

with psycopg.connect(DSN, autocommit=True) as conn:
    with conn.cursor() as cur:
        cur.execute(MIGRATION_SQL)
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='posts' ORDER BY ordinal_position"
        )
        print("posts columns:", [r[0] for r in cur.fetchall()])
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' ORDER BY table_name"
        )
        print("tables:", [r[0] for r in cur.fetchall()])