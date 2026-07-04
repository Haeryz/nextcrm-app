# Changes

This file documents the current auth, admin/customer, MekTek, and routing changes made in this worktree.

## Summary

- Authentication is now credentials-only. Google and GitHub login buttons and NextAuth providers were removed.
- The public sign-in screen is now an admin email/password login. Successful admin login routes to `/{locale}/mektek/dashboard`.
- Normal customer credentials are still supported through the customer access flow and customer profile flow.
- Public staff registration no longer creates an admin account, even for the first user. Admin accounts are created through a backend bootstrap script.
- `NEXTCRM_DISABLE_AUTH` is now opt-in only when set to `"true"`. The previous behavior could accidentally run the app in no-auth mode unless explicitly disabled.
- Real signed-in sessions are no longer promoted to admin in no-auth mode. Only the fallback guest session gets the local prototype admin bypass.
- Customers can no longer access the MekTek staff dashboard. Non-staff users entering the staff route group are redirected to their customer profile.
- The MekTek dashboard is admin-only. CS and technician users can still use the staff tools allowed by their role.
- Customer management can no longer create, edit, or delete admin/staff accounts.
- Catalog customers now have a `customerType` field with `STANDARD` and `B2B`.
- Public password reset no longer resets admin account passwords.
- Staff-only API gates were added for invoice/receipt access and WhatsApp status access.

## Changed Files

| File | What changed |
| --- | --- |
| `.env.example` | Set `NEXTCRM_DISABLE_AUTH` default to `false`, added admin bootstrap env vars, and removed Google/GitHub OAuth env placeholders. |
| `lib/auth.ts` | Removed Google and GitHub providers. Credentials provider is now the only NextAuth provider. |
| `app/[locale]/(auth)/sign-in/components/LoginComponent.tsx` | Removed OAuth buttons and register link. Login now uses credentials only and redirects admins to `/{locale}/mektek/dashboard`; non-admin credentials go to `/{locale}/customer/profile`. |
| `app/[locale]/(auth)/register/components/RegisterComponent.tsx` | Removed staff Google registration/login option. |
| `actions/auth/register-user.ts` | Public staff registration always creates non-admin pending users. Customer registration writes `customerType: STANDARD`. |
| `actions/auth/password-reset.ts` | Blocks admin password resets from the public reset flow. |
| `scripts/bootstrap-admin.ts` | Added backend-only admin bootstrap script using `NEXTCRM_ADMIN_EMAIL`, `NEXTCRM_ADMIN_PASSWORD`, and `NEXTCRM_ADMIN_NAME`. |
| `package.json` | Added `admin:bootstrap` script. |
| `lib/session.ts` | Made no-auth mode explicit (`NEXTCRM_DISABLE_AUTH === "true"`) and preserved real user admin/role/status values. |
| `proxy.ts` | Made no-auth mode explicit, uses `JWT_SECRET` or `NEXTAUTH_SECRET`, and protects `/api/whatsapp` for admin/CS users. |
| `lib/api-gates.ts` | Added reusable API session gates for MekTek staff routes and MekTek customer-tool routes. |
| `lib/mektek/permissions.ts` | Added `canViewMektekDashboard`, making the dashboard admin-only. |
| `app/[locale]/(routes)/layout.tsx` | Redirects unauthenticated users to sign-in, pending/inactive users to status pages, and non-staff users to `/{locale}/customer/profile`. |
| `app/[locale]/(routes)/components/menu-items/Mektek.tsx` | Shows menu items based on role: dashboard admin-only, items admin/CS, WhatsApp admin/CS, customers admin-only. |
| `app/[locale]/(routes)/mektek/dashboard/page.tsx` | Dashboard access changed from staff-wide to admin-only. |
| `prisma/schema.prisma` | Added `CatalogCustomerType` enum and `CatalogCustomer.customerType`. |
| `prisma/migrations/20260704020000_customer_type_and_admin_hardening/migration.sql` | Adds the database enum, `customerType` column, and index. |
| `actions/mektek/service-orders.ts` | Persists customer type on service orders and customer search results. |
| `actions/mektek/catalog-purchase.ts` | Persists `STANDARD` customer type for catalog purchase customer records. |
| `actions/mektek/customer-profile.ts` | Includes customer type in the customer profile data. |
| `actions/mektek/customers.ts` | Adds customer type handling, removes admin/staff role controls from customer CRUD, and protects staff/admin-linked accounts. |
| `app/[locale]/(routes)/mektek/_components/NewServiceOrderForm.tsx` | Adds customer type selector and uses customer type from selected customer search results. |
| `app/[locale]/(routes)/mektek/customers/_components/CustomerUserManager.tsx` | Adds customer type field/badge and removes admin/staff controls from customer management. |
| `app/[locale]/customer/profile/page.tsx` | Shows a B2B badge for B2B customer profiles. |
| `app/api/mektek/service-orders/[id]/invoice/route.ts` | Keeps public token/code access, but requires MekTek staff session for non-public invoice access. |
| `app/api/mektek/service-orders/[id]/receipt/route.ts` | Keeps public token/code access, but requires MekTek staff session for non-public receipt access. |
| `app/api/whatsapp/status/route.ts` | Requires admin/CS access before returning WhatsApp status. |
| `__tests__/auth/password-reset.test.ts` | Covers admin password reset blocking. |
| `__tests__/auth/session.test.ts` | Covers no-auth mode not promoting a real customer session to admin. |
| `__tests__/mektek/permissions.test.ts` | Covers admin-only dashboard access and customer exclusion from staff/admin permissions. |
| `docs/panduan-operasional-dan-testing-mektek.md` | Removed the outdated OAuth login mention. |

Ignored local env files were also adjusted so `NEXTCRM_DISABLE_AUTH=false` locally. Those files are not part of the tracked git diff.

## Admin Account Creation

Create or update the admin account through the backend bootstrap command:

```bash
NEXTCRM_ADMIN_EMAIL="admin@example.com" \
NEXTCRM_ADMIN_PASSWORD="replace-with-at-least-12-characters" \
NEXTCRM_ADMIN_NAME="NextCRM Admin" \
pnpm admin:bootstrap
```

The script upserts the user, sets `is_admin=true`, `is_account_admin=true`, `userStatus=ACTIVE`, and clears `mektekRole`.

## Verification Run

- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/eslint . --max-warnings=0`
- `./node_modules/.bin/jest --runInBand`
- `./node_modules/.bin/prisma generate`
- `./node_modules/.bin/prisma migrate deploy`
- `./node_modules/.bin/next build`

Notes:

- `pnpm` itself failed its package-manager signature switch in this environment, so the local project binaries were used directly.
- `prisma migrate deploy` reported no pending migrations.
- `next build` passed after running outside the sandbox restriction that prevented Turbopack from binding its local worker port.

## Routing Overview

The app uses the Next.js App Router under `app/`.

- Supported locales: `en`, `cz`, `de`, `uk`.
- Default locale: `en`.
- Route groups like `(auth)` and `(routes)` do not appear in the URL.
- Canonical page URLs are locale-prefixed, for example `/en/customer`.
- `proxy.ts` applies next-intl routing to non-API routes.

## Page Routes

| Route | Source file | Purpose / access |
| --- | --- | --- |
| `/{locale}` | `app/[locale]/page.tsx` | Locale home. Redirects to `/{locale}/customer`. |
| `/{locale}/customer` | `app/[locale]/customer/page.tsx` | Public MekTek customer landing page. With `?view=sparepart`, shows the public sparepart catalogue. Supports `q`, `machine`, and `page` query params. |
| `/{locale}/customer/access` | `app/[locale]/customer/access/page.tsx` | Public customer login/sign-up entry using phone/password. |
| `/{locale}/customer/profile` | `app/[locale]/customer/profile/page.tsx` | Authenticated customer profile with linked services, vouchers, live status, invoice/receipt links, and B2B badge. Redirects unauthenticated users to `/sign-in`. |
| `/{locale}/service-status/{id}?token=...` | `app/[locale]/service-status/[id]/page.tsx` | Public service tracking page for a service order id plus customer token. Returns 404 without a valid token/order. |
| `/{locale}/s/{code}` | `app/[locale]/s/[code]/page.tsx` | Short public tracking URL. Resolves code to order/token, then renders the same service status page. |
| `/{locale}/sign-in` | `app/[locale]/(auth)/sign-in/page.tsx` | Admin credentials login page. Google/GitHub login removed. Admin success redirects to `/{locale}/mektek/dashboard`. |
| `/{locale}/register` | `app/[locale]/(auth)/register/page.tsx` | Customer/staff registration page. Staff registration creates pending non-admin users. |
| `/{locale}/pending` | `app/[locale]/(auth)/pending/page.tsx` | Pending account status page. Only shown when the signed-in user has `userStatus=PENDING`; otherwise redirects to `/`. |
| `/{locale}/inactive` | `app/[locale]/(auth)/inactive/page.tsx` | Inactive account status page. Only shown when the signed-in user has `userStatus=INACTIVE`; otherwise redirects to `/`. |
| `/{locale}/mektek` | `app/[locale]/(routes)/mektek/page.tsx` | MekTek service order workspace. Requires admin, CS, or technician. Admin/CS can create orders; technician can view staff workspace data allowed by permissions. Supports `dateFrom`, `dateTo`, and `page`. |
| `/{locale}/mektek/{id}` | `app/[locale]/(routes)/mektek/[id]/page.tsx` | Staff service order detail page. Requires admin, CS, or technician. Progress updates are role-gated; customer tools and payment tools are separately gated. |
| `/{locale}/mektek/dashboard` | `app/[locale]/(routes)/mektek/dashboard/page.tsx` | Operational MekTek dashboard. Admin-only. |
| `/{locale}/mektek/items` | `app/[locale]/(routes)/mektek/items/page.tsx` | Catalogue item management. Admin/CS only. Supports `q`, `machine`, and `page`. |
| `/{locale}/mektek/customers` | `app/[locale]/(routes)/mektek/customers/page.tsx` | Customer/user management. Admin-only. Supports `q` and `page`. |
| `/{locale}/mektek/whatsapp` | `app/[locale]/(routes)/mektek/whatsapp/page.tsx` | WhatsApp integration UI. It sits inside the staff route group; the menu and `/api/whatsapp` gate restrict actual WhatsApp tooling to admin/CS. |

## Layout Routes And Guards

| Layout | Source file | Behavior |
| --- | --- | --- |
| `/{locale}` root layout | `app/[locale]/layout.tsx` | Provides locale messages, theme provider, global CSS, and toast providers. |
| Auth group layout | `app/[locale]/(auth)/layout.tsx` | Centers sign-in/register/pending/inactive screens and shows the theme toggle. |
| Staff route group layout | `app/[locale]/(routes)/layout.tsx` | Requires an authenticated active user. Redirects unauthenticated users to `/sign-in`, pending users to `/pending`, inactive users to `/inactive`, and non-staff users to `/{locale}/customer/profile`. |

## Loading Routes

These files provide loading states for route segments:

- `app/[locale]/loading.tsx`
- `app/[locale]/(routes)/loading.tsx`
- `app/[locale]/(routes)/mektek/loading.tsx`
- `app/[locale]/(routes)/mektek/dashboard/loading.tsx`
- `app/[locale]/(routes)/mektek/items/loading.tsx`
- `app/[locale]/(routes)/mektek/customers/loading.tsx`
- `app/[locale]/(routes)/mektek/whatsapp/loading.tsx`

## API Routes

| Route | Source file | Methods / access |
| --- | --- | --- |
| `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | NextAuth handler. Credentials-only after this change. |
| `/api/mektek/payments/notification` | `app/api/mektek/payments/notification/route.ts` | `POST` payment notification webhook. Updates MekTek payment/order data and revalidates public tracking pages. |
| `/api/mektek/service-orders/{id}/invoice` | `app/api/mektek/service-orders/[id]/invoice/route.ts` | `GET` invoice PDF. Public with `?code=...` or `?token=...`; otherwise requires MekTek staff session. `download=1` forces download. |
| `/api/mektek/service-orders/{id}/receipt` | `app/api/mektek/service-orders/[id]/receipt/route.ts` | `GET` receipt PDF. Public with `?code=...` or `?token=...`; otherwise requires MekTek staff session. `download=1` forces download. |
| `/api/mektek/service-orders/{id}/stream?token=...` | `app/api/mektek/service-orders/[id]/stream/route.ts` | `GET` server-sent events for public live service status. Requires valid token. |
| `/api/whatsapp/status` | `app/api/whatsapp/status/route.ts` | `GET` WhatsApp client status. Requires admin or CS. |

## Proxy-Protected API Prefixes

`proxy.ts` additionally protects these API prefixes before route handlers run:

- `/api/user/activateAdmin/:path*` - admin-only.
- `/api/user/deactivateAdmin/:path*` - admin-only.
- `/api/user/activate/:path*` - admin-only.
- `/api/user/deactivate/:path*` - admin-only.
- `/api/user/inviteuser` - admin-only.
- `/api/admin/:path*` - admin-only.
- `/api/whatsapp/:path*` - admin or CS.

`/api/inngest` is passed through because Inngest handles its own signing/authentication.
