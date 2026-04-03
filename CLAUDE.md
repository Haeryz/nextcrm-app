# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                        # Start development server
pnpm build                      # Build via scripts/build.js
pnpm build:full                 # prisma generate + migrate deploy + next build
pnpm lint                       # ESLint (--max-warnings=0, zero warnings allowed)
pnpm test                       # Jest unit tests
pnpm test:e2e                   # Playwright e2e tests
pnpm test:e2e:ui                # Playwright with UI

# Database
pnpm prisma generate            # Regenerate Prisma client after schema changes
pnpm prisma migrate deploy      # Apply pending migrations
pnpm prisma db seed             # Seed initial data (ts-node ./prisma/seeds/seed.ts)
```

Run a single Jest test file:
```bash
pnpm jest __tests__/path/to/test.test.ts
```

## Architecture

### Routing & i18n

All app routes live under `app/[locale]/`. The `[locale]` segment is handled by `next-intl` with four locales: `en`, `cz`, `de`, `uk`. Locale messages are in `locales/*.json`; the `i18n/request.ts` file configures the timezone as `Europe/Prague`.

Within `[locale]/`:
- `(auth)/` — login, sign-in, pending, inactive pages (unauthenticated)
- `(routes)/` — all authenticated app pages; the layout at `app/[locale]/(routes)/layout.tsx` enforces session and handles `PENDING`/`INACTIVE` redirects

The main `app/api/` routes are standard Next.js Route Handlers outside the locale segment.

### Authentication

Auth is handled by **next-auth v4** (JWT strategy) in `lib/auth.ts`. Always import `getServerSession` from `lib/session.ts` — **not** directly from `next-auth`. The `lib/session.ts` wrapper adds no-auth/guest mode support.

**No-auth mode** (default in `.env.example`): set `NEXTCRM_DISABLE_AUTH=true`. The app upserts a guest user in the DB and every session resolves to that user with `isAdmin: true`. Useful for local development without OAuth.

**Prototype mode**: `NEXTCRM_PROTOTYPE_MODE=true` or `DISABLE_EXTERNAL_APIS=true` disables OAuth providers, AI services, Resend, MinIO, Inngest, and IMAP/SMTP. Check `lib/external-apis.ts` (`areExternalApisDisabled()`) before calling any external API.

### Database

Prisma 7 + PostgreSQL 17+ with the **pgvector** extension (required for vector search). The client singleton is in `lib/prisma.ts`. It uses `@prisma/adapter-pg` with connection pooling via `pg`. If `DATABASE_URL` is not set, a mock client is returned so the app boots without a database.

All DB calls go through the `prismadb` export from `lib/prisma.ts`.

CRM model names use the `crm_` prefix (e.g. `crm_Accounts`, `crm_Leads`).

**Soft delete**: CRM entities use `deletedAt`/`deletedBy` columns — records are never hard-deleted. Always filter `deletedAt: null` in queries unless intentionally accessing deleted records.

### Server Actions

Server actions live in `actions/`. Use `createSafeAction` from `lib/create-safe-action.ts` for Zod-validated actions that return `ActionState<TInput, TOutput>`.

### Background Jobs (Inngest)

`inngest/` contains the Inngest client (`client.ts`) and functions (`functions/`). Functions handle:
- Vector embedding for CRM records on create/update (`embed-*.ts`)
- Backfill embedding for existing records
- AI enrichment of Targets and Contacts via E2B sandboxed Chrome agent (`enrich-*.ts`)

### MCP Server

Exposed at `/api/mcp/[transport]` (supports `sse` and `http`). Implemented with `@vercel/mcp-adapter`. Tools are defined per-module in `lib/mcp/tools/`. Auth uses Bearer tokens (`nxtc__...`) generated from user profiles, checked via `lib/mcp/auth.ts`.

### AI & Enrichment

- **Embeddings**: OpenAI `text-embedding-3-small` via Inngest jobs; stored in pgvector with HNSW indexes
- **Enrichment agent**: Claude Sonnet 4.6 in an E2B cloud sandbox with real Chrome browser
- **API key priority**: ENV variable → admin panel (`/admin/llm-keys`) → user profile. Keys encrypted with AES-256-GCM; `EMAIL_ENCRYPTION_KEY` (64-char hex) is required in env

### UI

- **shadcn/ui** components in `components/ui/` (Radix UI + Tailwind CSS v4)
- **Tailwind CSS v4** — note: v4 has different config conventions from v3
- Page-level components are colocated in `_components/` folders within route directories
- Shared components in `components/` (CRM-specific, form elements, modals, sheets)

### Key Modules

| Path | Description |
|------|-------------|
| `app/[locale]/(routes)/crm/` | CRM: Accounts, Contacts, Leads, Opportunities, Contracts, Tasks |
| `app/[locale]/(routes)/campaigns/` | Targets, Target Lists, Campaigns |
| `app/[locale]/(routes)/mektek/` | Custom Indonesian auto-service order management (built on CRM Accounts) |
| `app/[locale]/(routes)/admin/` | User management, audit log, LLM key management, CRM settings |
| `app/[locale]/(routes)/projects/` | Project management |
| `app/[locale]/(routes)/emails/` | IMAP/SMTP email client |
| `app/[locale]/(routes)/documents/` | Document storage (MinIO/S3) |
| `app/[locale]/(routes)/reports/` | Reports and charts (Tremor/Recharts) |

### Mektek Module

A custom vertical built on top of CRM Accounts for auto-service management. Service orders (`crm_Tasks` model with `taskStatus` ACTIVE/PENDING/COMPLETE) include timeline entries stored as JSON in the `tags` field, notes/comments, and customer-facing tracking links. Located in `app/[locale]/(routes)/mektek/` with actions in `actions/mektek/`.

### Audit Log

All CRM entities track field-level change history. A `diffObjects` utility computes before/after diffs stored as structured JSON. The global admin audit log is at `/admin/audit-log`. The `AuditTimeline` and `AuditEntry` components render per-entity history.

## Environment Setup

Copy both example files:
```bash
cp .env.example .env
cp .env.local.example .env.local
```

Minimum required for local dev with no-auth mode (no external services):
- `DATABASE_URL` — PostgreSQL 17+ with pgvector extension
- `NEXTCRM_DISABLE_AUTH=true` (already set in `.env.example`)
- `EMAIL_ENCRYPTION_KEY` — 64-char hex, required for API key encryption (`openssl rand -hex 32`)

## Testing

- **Jest**: tests in `__tests__/`, config in `jest.config.ts`, uses `ts-jest`. E2B is mocked via `__mocks__/e2b.ts`.
- **Playwright**: tests in `tests/e2e/`, config in `playwright.config.ts`. Auth setup in `tests/auth.setup.ts`.
