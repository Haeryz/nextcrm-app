#!/usr/bin/env bash
# ============================================================
# NextCRM — one-shot production setup (no domain required)
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }

# ── Prerequisites ────────────────────────────────────────────
command -v docker  >/dev/null 2>&1 || { error "docker is not installed"; exit 1; }
command -v openssl >/dev/null 2>&1 || { error "openssl is required"; exit 1; }

# ── .env.production ──────────────────────────────────────────
if [ ! -f ".env.production" ]; then
    cp .env.production.example .env.production
    info "Created .env.production"

    # Auto-generate all secrets
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 32)
    EMAIL_ENCRYPTION_KEY=$(openssl rand -hex 32)
    CRON_SECRET=$(openssl rand -hex 16)
    POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+')
    MINIO_ROOT_PASSWORD=$(openssl rand -base64 24 | tr -d '/+')
    PGADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '/+')

    sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEXTAUTH_SECRET}|"           .env.production
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|"                           .env.production
    sed -i "s|^EMAIL_ENCRYPTION_KEY=.*|EMAIL_ENCRYPTION_KEY=${EMAIL_ENCRYPTION_KEY}|" .env.production
    sed -i "s|^CRON_SECRET=.*|CRON_SECRET=${CRON_SECRET}|"                        .env.production
    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|"     .env.production
    sed -i "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}|" .env.production
    sed -i "s|^PGADMIN_PASSWORD=.*|PGADMIN_PASSWORD=${PGADMIN_PASSWORD}|"         .env.production

    info "All secrets auto-generated."
else
    info ".env.production already exists — skipping generation."
fi

# ── Detect server IP ─────────────────────────────────────────
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")

# Prompt to set the server IP in NEXTAUTH_URL if it still says localhost
if grep -q 'NEXTAUTH_URL=http://localhost' .env.production; then
    echo ""
    warn "NEXTAUTH_URL is set to localhost."
    warn "If this server has IP ${SERVER_IP} and you want to access it from other machines, run:"
    echo ""
    echo "    sed -i 's|http://localhost:3000|http://${SERVER_IP}:3000|g' .env.production"
    echo "    sed -i 's|http://localhost:9000|http://${SERVER_IP}:9000|g' .env.production"
    echo ""
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
info "Setup complete. To start everything:"
echo ""
echo "    docker compose --env-file .env.production up -d --build"
echo ""
info "Access the app at:"
echo "    App      → http://${SERVER_IP}:3000"
echo "    MinIO UI → http://${SERVER_IP}:9001"
echo "    pgAdmin  → http://${SERVER_IP}:5050"
echo ""
info "Watch logs:"
echo "    docker compose --env-file .env.production logs -f nextcrm"
