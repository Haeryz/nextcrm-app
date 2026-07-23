# syntax=docker/dockerfile:1.7-labs

# ============================================================
# Stage 1 — base: Node.js + pnpm
# ============================================================
FROM node:22-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Pin pnpm to the same version used by the project.
RUN corepack enable \
    && corepack prepare pnpm@10.28.0 --activate


# ============================================================
# Stage 2 — deps: install all dependencies
# ============================================================
FROM base AS deps

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# package.json postinstall references this file.
COPY scripts/ensure-whatsapp-browser.js \
    ./scripts/ensure-whatsapp-browser.js

# Do not download Puppeteer's bundled browser.
# Chromium is installed from Debian in the runner stage.
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile


# ============================================================
# Stage 3 — builder: Prisma generate + Next.js build
# ============================================================
FROM base AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# prisma.config.ts requires a valid database URL while loading.
# This URL is only used during image build and is not contacted
# by `prisma generate`.
ARG BUILD_DATABASE_URL="postgresql://postgres:build-only@localhost:5432/nextcrm?schema=public"
ENV DATABASE_URL="${BUILD_DATABASE_URL}"

RUN pnpm exec prisma generate

ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js in standalone mode.
# Runtime DATABASE_URL will be supplied by Docker Compose.
RUN pnpm exec next build


# ============================================================
# Stage 4 — runner: production image
# ============================================================
FROM node:22-slim AS runner

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        chromium \
        fonts-liberation \
        openssl \
        wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"
ENV WHATSAPP_CHROME_PATH="/usr/bin/chromium"

RUN groupadd --system --gid 1001 nodejs \
    && useradd \
        --system \
        --uid 1001 \
        --gid nodejs \
        --create-home \
        nextjs


# ============================================================
# Next.js standalone output
# ============================================================
COPY --from=builder --chown=nextjs:nodejs \
    /app/public \
    ./public

COPY --from=builder --chown=nextjs:nodejs \
    /app/.next/standalone \
    ./

COPY --from=builder --chown=nextjs:nodejs \
    /app/.next/static \
    ./.next/static


# ============================================================
# Runtime dependencies
# ============================================================
# Copy the complete pnpm node_modules tree.
#
# pnpm stores real packages inside node_modules/.pnpm and exposes
# packages through symlinks. Copying Prisma, Sharp, or the CLI
# separately would break those symlinks.
COPY --from=builder --chown=nextjs:nodejs \
    /app/node_modules \
    ./node_modules


# ============================================================
# Prisma configuration and migrations
# ============================================================
COPY --from=builder --chown=nextjs:nodejs \
    /app/prisma \
    ./prisma

COPY --from=builder --chown=nextjs:nodejs \
    /app/prisma.config.ts \
    ./prisma.config.ts


# ============================================================
# Entrypoint
# ============================================================
COPY --chown=nextjs:nodejs \
    entrypoint.sh \
    ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=60s \
    --retries=3 \
    CMD wget -qO- "http://localhost:${PORT:-3000}/" >/dev/null || exit 1

ENTRYPOINT ["./entrypoint.sh"]