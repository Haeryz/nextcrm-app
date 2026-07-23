#!/usr/bin/env bash
# ============================================================
# NextCRM — one-shot production setup
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

    sed -i '' "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEXTAUTH_SECRET}|"           .env.production
    sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|"                           .env.production
    sed -i '' "s|^EMAIL_ENCRYPTION_KEY=.*|EMAIL_ENCRYPTION_KEY=${EMAIL_ENCRYPTION_KEY}|" .env.production
    sed -i '' "s|^CRON_SECRET=.*|CRON_SECRET=${CRON_SECRET}|"                        .env.production
    sed -i '' "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|"     .env.production

    info "All secrets auto-generated."
else
    info ".env.production already exists — skipping generation."
fi

# ── Required public routing settings ─────────────────────────
APP_DOMAIN=$(sed -n 's/^APP_DOMAIN=//p' .env.production | tail -1)
TRAEFIK_ACME_EMAIL=$(sed -n 's/^TRAEFIK_ACME_EMAIL=//p' .env.production | tail -1)
if [ -z "${APP_DOMAIN}" ] || [ -z "${TRAEFIK_ACME_EMAIL}" ]; then
    warn "Set APP_DOMAIN and TRAEFIK_ACME_EMAIL in .env.production before starting."
    warn "The domain must resolve to this server and ports 80/443 must be reachable."
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
info "Setup complete. To start everything:"
echo ""
echo "    docker compose --env-file .env.production up -d --build"
echo ""
info "After setting the routing values, access the app at:"
echo "    https://<APP_DOMAIN>"
echo ""
info "Watch logs:"
echo "    docker compose --env-file .env.production logs -f appbuild"
