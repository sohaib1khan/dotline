#!/bin/sh
set -eu

echo "Waiting for database..."
python - <<'PY'
import os
import time

import psycopg

host = os.environ.get("POSTGRES_HOST", "db")
port = int(os.environ.get("POSTGRES_PORT", "5432"))
user = os.environ["POSTGRES_USER"]
password = os.environ["POSTGRES_PASSWORD"]
dbname = os.environ["POSTGRES_DB"]

deadline = time.time() + 60
while True:
    try:
        with psycopg.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=dbname,
            connect_timeout=3,
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        break
    except Exception as exc:
        if time.time() >= deadline:
            raise SystemExit(f"Database not ready: {exc}") from exc
        time.sleep(1)

print("Database is ready.")
PY

echo "Running migrations..."
alembic upgrade head

echo "Starting Dotline..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
