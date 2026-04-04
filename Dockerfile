# syntax=docker/dockerfile:1.7-labs
# ============================================================
# Stage 1 — base: node + pnpm
# ============================================================
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ============================================================
# Stage 2 — deps: install all node_modules
# ============================================================
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# BuildKit cache speeds up repeated installs
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================================
# Stage 3 — builder: generate Prisma client + Next.js build
# ============================================================
FROM base AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (does NOT require a live DB)
RUN pnpm exec prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
# Build Next.js in standalone mode (see next.config.js)
# DATABASE_URL intentionally omitted — migrations run at container startup
RUN pnpm exec next build

# ============================================================
# Stage 4 — runner: minimal production image
# ============================================================
FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN groupadd --system --gid 1001 nodejs && \
    useradd  --system --uid 1001 --gid nodejs nextjs

# --- Next.js standalone output ---
COPY --from=builder /app/public                              ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static  ./.next/static

# --- Prisma: client + query-engine binaries ---
# These native binaries are NOT auto-included in standalone output
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma        ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client  ./node_modules/@prisma/client

# --- Prisma CLI (only needed for `migrate deploy` at startup) ---
COPY --from=builder /app/node_modules/.bin/prisma                           /usr/local/bin/prisma
COPY --from=builder /app/node_modules/prisma                                /usr/local/lib/node_modules/prisma

# --- Migration files ---
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# --- Sharp (image optimisation — native module) ---
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp           ./node_modules/sharp

# --- Entrypoint ---
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["./entrypoint.sh"]
