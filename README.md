# MektekCRM

MektekCRM is a localized Next.js application for managing Mektek service workflows. It combines a public customer website, customer self-service tracking, and an authenticated staff/admin workspace for service orders, payments, catalog items, customers, and WhatsApp notifications.

The app is built from the NextCRM codebase but is currently scoped to the Mektek workflow.

## Main Features

- Public customer landing page at `/{locale}/customer`
- Customer account access and profile pages for service history and vouchers
- Public service-status links at `/{locale}/s/{code}` and `/{locale}/service-status/{id}`
- Staff service-order workspace at `/{locale}/mektek`
- Admin dashboard at `/{locale}/mektek/dashboard`
- Customer, catalog item, payment, invoice, and receipt management
- Midtrans payment integration for Mektek checkout and payment notifications
- WhatsApp notification status and staff controls
- Role-aware staff access for admins, CS, and technicians
- Light/dark/system theme support in the admin sidebar
- Internationalized routing with `en`, `cz`, `de`, and `uk`

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS and shadcn/ui components
- next-intl for localization
- NextAuth credentials authentication
- Prisma 7 with PostgreSQL
- Jest for unit tests
- Playwright for end-to-end tests
- Midtrans Snap payments
- WhatsApp Web integration

## Project Structure

```text
app/[locale]/customer/          Public customer website and profile pages
app/[locale]/(auth)/            Sign-in, registration, setup, and reset flows
app/[locale]/(routes)/mektek/   Authenticated Mektek staff/admin workspace
app/api/auth/                   NextAuth route handlers
app/api/mektek/                 Mektek payment, invoice, and receipt APIs
actions/mektek/                 Server actions for Mektek workflows
components/mektek/              Customer-facing Mektek UI and cart components
lib/mektek/                     Permissions, payments, loyalty, and helpers
prisma/                         Database schema and migrations
locales/                        Translation JSON files
docs/                           Operational and testing documentation
```

## Requirements

- Node.js 22.x
- pnpm 9 or newer
- PostgreSQL database
- Prisma-compatible `DATABASE_URL`

The project is pinned to `pnpm@10.28.0` through `packageManager`.

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Configure at least these variables:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-secure-secret"
JWT_SECRET="replace-with-a-secure-secret"
```

Generate Prisma Client and run the development server:

```bash
pnpm exec prisma generate
pnpm dev
```

The dev script prints the main entry points:

```text
Customer: http://localhost:3000/customer
Staff:    http://localhost:3000/mektek
Admin:    http://localhost:3000/mektek/dashboard
```

## Admin Bootstrap

To create or update the initial admin account, set these variables in `.env.local`:

```env
NEXTCRM_ADMIN_EMAIL="admin@example.com"
NEXTCRM_ADMIN_PASSWORD="replace-with-at-least-12-characters"
NEXTCRM_ADMIN_NAME="NextCRM Admin"
```

Then run:

```bash
pnpm admin:bootstrap
```

## Environment Variables

Core variables:

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: public app URL used by NextAuth
- `NEXTAUTH_SECRET`: NextAuth signing secret
- `JWT_SECRET`: JWT fallback/signing secret
- `NEXT_PUBLIC_APP_URL`: public base URL for generated links
- `NEXT_PUBLIC_APP_NAME`: display name used in the admin sidebar

Mektek payment variables:

- `MIDTRANS_IS_PRODUCTION`
- `MIDTRANS_MERCHANT_ID`
- `MIDTRANS_SERVER_KEY`
- `MIDTRANS_CLIENT_KEY`
- `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`

Optional integrations in `.env.example` include Resend, Rossum, MinIO, SMTP/IMAP, cron secrets, and external API keys.

## Main Routes

| Route | Purpose |
| --- | --- |
| `/{locale}` | Redirects to the customer landing page |
| `/{locale}/customer` | Public customer website |
| `/{locale}/customer/access` | Customer login/register access flow |
| `/{locale}/customer/profile` | Customer profile and service history |
| `/{locale}/sign-in` | Staff/admin sign-in |
| `/{locale}/register` | Registration |
| `/{locale}/mektek` | Service order list and creation workflow |
| `/{locale}/mektek/{id}` | Service order detail, timeline, payment, and tracking link |
| `/{locale}/mektek/dashboard` | Admin operations dashboard |
| `/{locale}/mektek/items` | Catalog item management |
| `/{locale}/mektek/customers` | Customer management |
| `/{locale}/mektek/whatsapp` | WhatsApp status and controls |
| `/{locale}/s/{code}` | Short public tracking URL |
| `/{locale}/service-status/{id}` | Public service status page |

Supported locales are `en`, `cz`, `de`, and `uk`; the default locale is `en`.

## Common Commands

```bash
pnpm dev                    # start local development server
pnpm build                  # production build
pnpm build:full             # prisma generate + migrate deploy + next build
pnpm start                  # start production server
pnpm lint                   # run ESLint
pnpm test                   # run Jest tests
pnpm test:e2e               # run Playwright tests
pnpm migrate:deploy         # deploy Prisma migrations
pnpm catalog:import         # import catalog data
```

## Verification

Run the core validation checks before shipping changes:

```bash
pnpm exec prisma validate
pnpm exec tsc --noEmit
pnpm lint
pnpm test
```

For the focused Mektek test set:

```bash
pnpm test -- --runTestsByPath __tests__/mektek/permissions.test.ts __tests__/mektek/items.test.ts __tests__/mektek/loyalty.test.ts __tests__/mektek/public-status.test.ts __tests__/mektek/dashboard.test.ts
```

For browser coverage:

```bash
pnpm test:e2e
```

## Deployment Notes

- The Next.js config uses `output: "standalone"`.
- Production deployments need a reachable PostgreSQL database and the required auth/payment secrets.
- Run Prisma migrations before starting the production app.
- Keep `NEXTCRM_DISABLE_AUTH="false"` outside local prototype environments.
- Keep Midtrans production mode disabled until sandbox payments are verified.

## Operational Documentation

Additional usage and testing guidance is available in:

- `docs/panduan-operasional-dan-testing-mektek.md`
- `midtrans.md`
- `security.md`
