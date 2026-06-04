#!/usr/bin/env sh
set -eu

mkdir -p "${UBOOK_LOCAL_UPLOAD_DIR:-uploads}"

alembic upgrade head

if [ "${UBOOK_AUTO_SEED:-false}" = "true" ]; then
  python -m app.scripts.seed
fi

uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8080}"
