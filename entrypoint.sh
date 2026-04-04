#!/bin/sh
set -e

echo "[entrypoint] NextCRM starting up..."

# Run Prisma migrations before the server starts.
# prisma CLI is installed at /usr/local/bin/prisma and resolves migrations
# from ./prisma/ (copied into the image at build time).
if [ -n "$DATABASE_URL" ]; then
    echo "[entrypoint] Running database migrations..."
    NODE_PATH=/usr/local/lib/node_modules prisma migrate deploy
    echo "[entrypoint] Migrations complete."
else
    echo "[entrypoint] WARNING: DATABASE_URL is not set — skipping migrations."
fi

echo "[entrypoint] Starting Next.js server on port ${PORT:-3000}..."
exec node server.js
