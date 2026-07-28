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
ARG NEXT_PUBLIC_APP_NAME="MektekCRM"
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ARG NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=""
ENV DATABASE_URL="${BUILD_DATABASE_URL}"
ENV NEXT_PUBLIC_APP_NAME="${NEXT_PUBLIC_APP_NAME}"
ENV NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL}"
ENV NEXT_PUBLIC_MIDTRANS_CLIENT_KEY="${NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}"

RUN pnpm exec prisma generate

ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js in standalone mode.
# Runtime DATABASE_URL will be supplied by Docker Compose.
RUN pnpm exec next build


# ============================================================
# Stage 4 — migrator: one-shot Prisma migrations
# ============================================================
FROM deps AS migrator

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY scripts/bootstrap-admin.ts ./scripts/bootstrap-admin.ts
COPY lib/password-core.ts ./lib/password-core.ts

ARG BUILD_DATABASE_URL="postgresql://postgres:build-only@localhost:5432/nextcrm?schema=public"
RUN DATABASE_URL="${BUILD_DATABASE_URL}" ./node_modules/.bin/prisma generate

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]


# ============================================================
# Stage 5 — runner: production image
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
ENV NEXTCRM_MIGRATIONS_MANAGED=true

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
