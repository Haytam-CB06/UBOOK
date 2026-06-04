#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
mkdir -p backups
pg_dump "$DATABASE_URL" > "backups/ubook-$(date +%Y%m%d%H%M%S).sql"

