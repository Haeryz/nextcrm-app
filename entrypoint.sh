#!/bin/sh

set -eu

echo "[entrypoint] NextCRM starting up..."

# Prisma CLI requires one of these variables because prisma.config.ts
# validates the database URL when it is loaded.
MIGRATION_DATABASE_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}}"

if [ -n "$MIGRATION_DATABASE_URL" ]; then
    echo "[entrypoint] Running database migrations..."

    ./node_modules/.bin/prisma migrate deploy

    echo "[entrypoint] Database migrations complete."
else
    echo "[entrypoint] WARNING: No database URL is configured."
    echo "[entrypoint] Set DIRECT_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL."
    echo "[entrypoint] Skipping database migrations."
fi

echo "[entrypoint] Starting Next.js server on port ${PORT:-3000}..."

exec node server.js