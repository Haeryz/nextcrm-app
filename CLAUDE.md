# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Production
https://mektek-bice.vercel.app

## Commands

```bash
pnpm dev                        # scripts/dev.js: clears .next/dev cache, runs prisma generate,
                                #   ensures WhatsApp Chrome, then next dev. Prints customer/staff/admin URLs.
                                #   Keep the cache with NEXTCRM_KEEP_DEV_CACHE=true
pnpm build                      # Build via scripts/build.js
pnpm build:full                 # prisma generate + migrate deploy + next build
pnpm lint                       # ESLint (--max-warnings=0, zero warnings allowed)
pnpm test                       # Jest unit tests
pnpm test:e2e                   # Playwright e2e tests
pnpm test:e2e:ui                # Playwright with UI
pnpm catalog:import             # Import Mektek catalog data (scripts/import-catalog-data.js)

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
- `customer/` — public, token-gated customer portal for Mektek (service tracking, profile, vouchers). **Not** under `(routes)`, so it is not behind the app session guard; access is granted via customer access tokens (`customer/access`)

The main `app/api/` routes are standard Next.js Route Handlers outside the locale segment.

### Authentication

Auth is handled by **next-auth v4** (JWT strategy) in `lib/auth.ts`. Always import `getServerSession` from `lib/session.ts` — **not** directly from `next-auth`. The `lib/session.ts` wrapper adds no-auth/guest mode support.

**No-auth mode** (default in `.env.example`): set `NEXTCRM_DISABLE_AUTH=true`. The app upserts a guest user in the DB and every session resolves to that user with `isAdmin: true`. Useful for local development without OAuth.

⚠️ **Production must set `NEXTCRM_DISABLE_AUTH=false`.** No-auth mode makes every request an admin guest. `lib/session.ts` refuses to boot when `NODE_ENV=production` and no-auth is enabled, unless `NEXTCRM_ALLOW_NOAUTH_IN_PROD=true` is set as an explicit override. Never set that override on a real deployment.

**Prototype mode**: `NEXTCRM_PROTOTYPE_MODE=true` or `DISABLE_EXTERNAL_APIS=true` disables OAuth providers, AI services, Resend, MinIO, Inngest, and IMAP/SMTP. Check `lib/external-apis.ts` (`areExternalApisDisabled()`) before calling any external API.

#### Access guards & route protection

- **Central guards** live in `lib/auth-guards.ts`: `requireUser()` (any signed-in, non-suspended user), `requireAdmin()` (admins only), `requireMektekStaff()` (any Mektek staff), and `getSessionUser()` (nullable, no redirect). Prefer these in server components/layouts/actions over re-deriving session + role checks by hand.
- **App shell**: `app/[locale]/(routes)/layout.tsx` redirects unauthenticated users to `/sign-in` and gates `PENDING`/`INACTIVE`. Everything under `(routes)` is therefore login-only.
- **Role gating**: Mektek pages check `lib/mektek/permissions.ts` helpers. The WhatsApp pairing page is admin-only via `app/[locale]/(routes)/mektek/whatsapp/layout.tsx` (it exposes the pairing QR).
- **Checkout requires login**: `createMektekCatalogPurchaseIntent` (server) rejects unauthenticated calls with `{ code: "AUTH_REQUIRED" }`; the storefront cart (`components/mektek/cart/*`) also redirects guests to `/[locale]/customer/access` before opening checkout. A logged-in customer always checks out under their own account phone.
- **Unknown routes**: `app/[locale]/not-found.tsx` is the friendly 404 for unmatched pages; `app/api/[...notfound]/route.ts` returns a JSON 404 for unmatched `/api/*` calls.

#### First admin (non-technical bootstrap)

Point the client at **`/setup`** (e.g. `https://…/en/setup`). It shows a guided one-time wizard (`app/[locale]/(auth)/setup/`) to create the owner/admin account — no env editing, no DB access. `bootstrapFirstAdmin` (`actions/auth/bootstrap-admin.ts`) creates an `is_admin`, `ACTIVE` user and the page **self-disables** once any admin exists (redirects to sign-in), so it can't be used to mint extra admins later. After setup, the owner invites staff and assigns roles from within the app.

### Database

Prisma 7 + PostgreSQL. The client singleton is in `lib/prisma.ts`. It uses `@prisma/adapter-pg` with connection pooling via `pg`. If `DATABASE_URL` is not set, a mock client is returned so the app boots without a database.

All DB calls go through the `prismadb` export from `lib/prisma.ts`.

CRM model names use the `crm_` prefix (e.g. `crm_Accounts`, `crm_Leads`).

**No pgvector.** `prisma/schema.prisma` declares a plain `postgresql` datasource with **no `extensions` block** and no vector columns. The pgvector requirement described in upstream NextCRM does not apply to this fork — a stock PostgreSQL instance is sufficient.

**No soft delete — deletes are hard.** There is no `deletedAt` or `deletedBy` column anywhere in `prisma/schema.prisma` (`grep -c deletedAt prisma/schema.prisma` returns `0`). Deleting a record removes the row. Do **not** add `deletedAt: null` filters to queries, and do not assume a deleted record is recoverable. If soft delete is ever wanted, it has to be introduced as a schema change first.

### Server Actions

Server actions live in `actions/`. Use `createSafeAction` from `lib/create-safe-action.ts` for Zod-validated actions that return `ActionState<TInput, TOutput>`.

### Background Jobs, MCP Server, Vector Search, AI Enrichment — NOT APPLICABLE

> ⚠️ **None of this exists in this fork.** These subsystems belong to upstream
> NextCRM and were described here in error. Verified absent in the current tree:
>
> | Described as | Actual state |
> |---|---|
> | Inngest jobs in `inngest/` | No `inngest/` directory. No `embed-*.ts` or `enrich-*.ts` files anywhere. |
> | MCP server at `/api/mcp/[transport]`, tools in `lib/mcp/tools/`, Bearer `nxtc__...` tokens via `lib/mcp/auth.ts` | No `lib/mcp/` and no `app/api/mcp/` directory. |
> | Vector embeddings (OpenAI `text-embedding-3-small`) stored in pgvector with HNSW indexes | No vector or embedding columns and no `extensions` block in `prisma/schema.prisma`. There is no vector search. |
> | Per-user LLM key management at `/admin/llm-keys` | The route does not exist; neither does any `admin/` route group. No LLM key is encrypted anywhere. |
>
> Do not plan work against any of the above without building it first. `e2b/` is
> the one leftover that is still present on disk, but nothing in the app invokes it.
>
> `EMAIL_ENCRYPTION_KEY` (64-char hex) **is** real and required. Its only consumer
> is `lib/crypto/secret-box.ts`, which encrypts the **WhatsApp session** (see
> WhatsApp Integration below) — it has nothing to do with LLM keys.

### UI

- **shadcn/ui** components in `components/ui/` (Radix UI + Tailwind CSS v4)
- **Tailwind CSS v4** — note: v4 has different config conventions from v3
- Page-level components are colocated in `_components/` folders within route directories
- Shared components in `components/` (CRM-specific, form elements, modals, sheets)

### Key Modules

`app/[locale]/(routes)/` currently contains exactly one feature module —
`mektek/` — plus `components/`, `layout.tsx`, and `loading.tsx`.

| Path | Description |
|------|-------------|
| `app/[locale]/(routes)/mektek/` | Indonesian auto-service order management — the entire authenticated staff/admin workspace |
| `app/[locale]/customer/` | Public, token-gated customer portal (tracking, profile, vouchers, storefront) |
| `app/[locale]/(auth)/` | Sign-in, registration, setup wizard, password reset |
| `actions/mektek/` | Server actions backing the Mektek workflows |
| `lib/mektek/` | Permissions, payments, loyalty, and helpers |

> ⚠️ Upstream NextCRM's `crm/`, `campaigns/`, `admin/`, `projects/`, `emails/`,
> `documents/`, and `reports/` route groups were previously listed here. **None
> of them exist in this fork.** In particular there is no `admin/` route group,
> so neither `/admin/llm-keys` nor `/admin/audit-log` is reachable. Admin
> functionality lives under `mektek/dashboard` and `mektek/finance/audit`.

### Mektek Module

A custom vertical built on top of CRM Accounts for auto-service management. Service orders (`crm_Tasks` model with `taskStatus` ACTIVE/PENDING/COMPLETE) include timeline entries stored as JSON in the `tags` field, notes/comments, and customer-facing tracking links. Located in `app/[locale]/(routes)/mektek/` with actions in `actions/mektek/`. The customer-facing side lives in `app/[locale]/customer/`.

### WhatsApp Integration

> 📄 **Full doc: [`docs/whatsapp-on-vercel.md`](docs/whatsapp-on-vercel.md)** — architecture, **what is and isn't actually verified**, known risks, prerequisites, and troubleshooting. Read it before debugging this or trusting it in production.
>
> ⚠️ **Status: the post-scan path is unproven.** Pairing produces a real QR (verified against WhatsApp's live servers), but nothing past the scan — credentials persisting, the 515 reconnect, an actual send, media — has ever been executed, because it needs a physical phone. Treat the first real scan on the deployed URL as a go/no-go gate.

Mektek sends customer notifications over WhatsApp via **baileys** — WhatsApp's multi-device protocol spoken directly over a WebSocket, with **no browser**. `lib/whatsapp/index.ts` is the public surface (`sendWhatsAppMessage`, `getWhatsAppState`, `logoutWhatsApp`); it delegates to a driver in `lib/whatsapp/drivers/`. Phone numbers are normalized to Indonesian format (leading `0` → `62`); note Baileys addresses users as `<digits>@s.whatsapp.net` (`toWhatsAppJid`), **not** whatsapp-web.js's `@c.us` (`toWhatsAppChatId`) — the two are not interchangeable. Sending is short-circuited when `areExternalApisDisabled()` is true or no session is linked.

**Why it is built this way.** Serverless has no persistent process, no writable disk, and no shared memory between instances, so a long-lived session is impossible. Instead:

- **The session lives in Postgres**, not on disk (`lib/whatsapp/auth-state.ts`): `WhatsAppSession` holds the credentials, `WhatsAppSignalKey` the Signal key material. Both are encrypted at rest with AES-256-GCM (`lib/crypto/secret-box.ts`) under `EMAIL_ENCRYPTION_KEY` — the credentials are full send-as-the-business access. This is why a session now survives a redeploy.
- **Pairing is a single held-open request**, not a poll (`app/api/whatsapp/pair/route.ts`, SSE, `maxDuration = 300`). The socket that shows the QR must still be alive when it is scanned, so it lives for exactly as long as that one streaming response. Expect a `restartRequired` (515) close immediately after a successful scan — that is normal, and the route reconnects once with the newly issued credentials.
- **Sending connects, sends, and disconnects** per invocation (~3–8s). Sockets are deliberately **not** kept warm: WhatsApp allows one connection per linked device, so two instances on the same credentials would kick each other off (`440 connectionReplaced`). `lib/whatsapp/lease.ts` enforces one-at-a-time with a compare-and-swap lease row — **not** `pg_advisory_lock`, which is session-scoped and unreliable through Neon's PgBouncer pooler.
- `GET /api/whatsapp/status` is **read-only** and must stay that way; starting a session is an explicit admin action (`/api/whatsapp/pair`, `/api/whatsapp/logout`, both admin-gated).

**Local dev uses Baileys too**, so dev matches production. The legacy whatsapp-web.js + Puppeteer path is still available via `WHATSAPP_DRIVER=wwebjs` (`lib/whatsapp/drivers/wwebjs.ts`) for local debugging only — it is refused when `VERCEL=1`. Its Chrome binary is installed by `scripts/ensure-whatsapp-browser.js` (`postinstall`, and before `pnpm dev`); skip/override with `NEXTCRM_SKIP_WHATSAPP_BROWSER_INSTALL=true`, `PUPPETEER_SKIP_DOWNLOAD=true`, or `WHATSAPP_CHROME_PATH`/`PUPPETEER_EXECUTABLE_PATH`.

Vercel notes: **Fluid compute must be enabled** (it is what allows the 300s pairing window, on Hobby too), and `EMAIL_ENCRYPTION_KEY` must be set or pairing fails closed. `baileys` and `protobufjs` are in `serverExternalPackages` — Baileys inlines its Rust bridge as base64 WASM, and bundling it is at best pointless.

**Constraints to respect when changing this** (each is load-bearing; see the full doc for why):

- Never keep a socket warm across invocations, and never bypass the lease — two connections on the same credentials get one kicked off (440).
- Never treat a `515` close after a scan as an error; it is the expected hand-off to a reconnect.
- Never let `GET /api/whatsapp/status` start a session again.
- Never use `pg_advisory_lock` for the lease (Neon's pooler breaks it), and never `JSON.stringify` Baileys credentials without `BufferJSON`.
- Baileys defaults are hostile here and are overridden on purpose: `syncFullHistory` would download the entire chat history **on every send**, and `markOnlineOnConnect` would suppress notifications on the owner's real phone.
- Baileys is unofficial and `7.0.0-rc13` is a release candidate; using it risks the number being banned. This is outbound-only — **inbound messages are impossible in this architecture** and would force a persistent host.

**Customer phone verification (WhatsApp OTP)**: customer self-registration (`registerCustomerUser`) and claiming a walk-in customer record (`claimMektekCustomerByPhone`) require a one-time code sent over WhatsApp. Core logic is in `lib/otp.ts` (`issueOtpCode`/`verifyOtpCode`, single-use, 5-min TTL, ≤5 attempts, hash-only storage) with the request action in `actions/auth/phone-otp.ts`. It **fails closed in production**: if `areExternalApisDisabled()` or the WhatsApp session isn't `ready`, registration is unavailable (so the production WhatsApp session must be paired). In dev/prototype the code is logged to the server console instead, so the local flow stays testable. The `CustomerPhoneVerification` model requires a migration — run `pnpm prisma migrate deploy` on every environment (incl. Neon) after pulling.

### Audit Log

Auditing in this fork is **finance-scoped, not CRM-wide**. The `FinanceAuditEvent`
model in `prisma/schema.prisma` records finance activity, surfaced at
`app/[locale]/(routes)/mektek/finance/audit/page.tsx`.

> ⚠️ Upstream NextCRM's global audit log was previously described here: a
> `diffObjects` utility, field-level history on every CRM entity, a
> `/admin/audit-log` route, and `AuditTimeline`/`AuditEntry` components. **None
> of those exist in this tree.**

## Environment Setup

Copy the example file (there is no `.env.local.example` in this repo — only
`.env.example` and `.env.production.example` are tracked):
```bash
cp .env.example .env
cp .env.example .env.local
```

Minimum required for local dev with no-auth mode (no external services):
- `DATABASE_URL` — PostgreSQL (stock; no pgvector extension needed, see Database above)
- `NEXTCRM_DISABLE_AUTH=true` (already set in `.env.example`)
- `EMAIL_ENCRYPTION_KEY` — 64-char hex (`openssl rand -hex 32`). Encrypts the stored WhatsApp
  session; without it, WhatsApp pairing fails closed. Rotating it forces a re-scan of the QR.

Required in every **deployed** environment:
- `NEXTCRM_DISABLE_AUTH=false` — see the Authentication warning above.
- `EMAIL_ENCRYPTION_KEY` — as above. It is **not** optional in production if WhatsApp is used.
  Also enable **Fluid compute** on the Vercel project: QR pairing holds one request open for up
  to 300s, which is what Fluid allows (on Hobby too).
- `NEXT_PUBLIC_APP_URL` — the public origin (e.g. `https://mektek-bice.vercel.app`). Customer
  tracking links (sent over WhatsApp) and the password-reset link are built from this trusted
  config. `actions/mektek/service-orders.ts` `buildAppUrl` and `actions/auth/password-reset.ts`
  fall back to request `Host` headers **only** for loopback/local hosts, so if this is unset in
  production, links break rather than trust an attacker-controllable header (host-header
  injection defense). It's a `NEXT_PUBLIC_*` var, so it is inlined at build time — **redeploy**
  after changing it.

### ⛔ Legacy `nextcrm` identifiers that must NOT be renamed

The product is branded **MektekCRM**, but several `nextcrm` strings are
**identifiers, not branding**. They were deliberately left alone during the
rename. Do not "finish the job" — each of these breaks production if changed:

| Identifier | Why it must stay |
|---|---|
| The 12 `NEXTCRM_*` env var **names** (`NEXTCRM_DISABLE_AUTH`, `NEXTCRM_PROTOTYPE_MODE`, `NEXTCRM_ALLOW_NOAUTH_IN_PROD`, `NEXTCRM_ADMIN_EMAIL`/`_PASSWORD`/`_NAME`, `NEXTCRM_GUEST_USER_ID`/`_EMAIL`/`_NAME`/`_LANGUAGE`, `NEXTCRM_KEEP_DEV_CACHE`, `NEXTCRM_SKIP_WHATSAPP_BROWSER_INSTALL`) | These are the exact keys read by `process.env` in `lib/session.ts`, `scripts/*`, and friends, **and the exact keys set in the Vercel dashboard**. Renaming them in docs hands the reader instructions that silently fail closed — e.g. `NEXTCRM_DISABLE_AUTH` reverting to its default. In `.env.example` the keys are byte-identical on purpose; only the surrounding comments and display **values** were rebranded. |
| `@phone.nextcrm.local` | The synthetic email domain for phone-only accounts (`buildPhoneAccountEmail`). It is **already written into existing DB rows**. Renaming it splits the placeholder set, so the email-campaign audience filter would stop recognising the old rows and start mailing a fake domain. |
| `nxtc__` | MCP bearer-token prefix. A wire-format constant. |
| `guest@nextcrm.local` | Default `NEXTCRM_GUEST_USER_EMAIL` value and the upsert key for the no-auth guest user — changing it mints a second guest row instead of reusing the first. |
| The repo directory name `nextcrm-app`, and any absolute path containing it | Local clones, CI checkout paths, and the `${APP_IMAGE:-nextcrm-app}` default in `docker-compose.yml`. |

Rebranding is limited to **prose, display names, and the npm package name**.

## Testing

- **Jest**: tests in `__tests__/`, config in `jest.config.ts`, uses `ts-jest`. E2B is mocked via `__mocks__/e2b.ts`.
- **Playwright**: tests in `tests/e2e/`, config in `playwright.config.ts`. Auth setup in `tests/auth.setup.ts`.
