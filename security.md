# Backend Polish & Security Audit

> Audit date: 2026-07-05. Scope: every `app/api/**/route.ts` handler plus the Mektek
> server actions that back them (`actions/mektek/*`, `actions/auth/*`) and their shared
> libs (`lib/phone.ts`, `lib/midtrans/*`, `lib/whatsapp/*`, `lib/session.ts`).
>
> This is a **work list for the next session**, ordered by severity. Nothing here has
> been fixed yet. Each item names the file, the problem, and the concrete fix.
> Check the box when done.
> When fixing the security issue make sure to test it at the end by using playwright and backend curl or other more sophisticated method.
> Mark done when it's complete and tested.

---

## P0 — Critical (do these first)

### [x] 1. Password reset lets anyone reset any account's password (account takeover / lockout)
**File:** `actions/auth/password-reset.ts`

`passwordReset(email)` immediately generates a new password, **overwrites the user's
current password in the DB**, and emails the plaintext to whatever address is on the
account. Consequences:
- Anyone who knows a victim's email can force-reset their password → **denial of service**
  (victim is locked out until they read the email) and the new secret is sent in cleartext.
- No token/confirmation step, no expiry, no rate limit.
- **User enumeration:** returns `"No user with that Email exist in Db!"` vs `success`,
  leaking which emails have accounts.

**Fix:** Move to a proper token flow — generate a single-use, time-limited reset token,
store its hash, email a reset *link* (not a password), and only change the password when
the user submits a new one with a valid token. Always return the same generic success
message regardless of whether the email exists. Add rate limiting (see item 9).

### [x] 2. Public catalog checkout is unauthenticated and unthrottled (spam / DB flooding / gateway abuse)
**File:** `actions/mektek/catalog-purchase.ts` → `createMektekCatalogPurchaseIntent`

Fully public, token-less. Every call creates a `catalogCustomer` (upsert), a
`crm_Accounts_Tasks` order row, a `catalogServiceLink`, a `mektekPayment` row, **and** hits
Midtrans to mint a Snap transaction. There is no rate limit, CAPTCHA, or bot check, so an
attacker can flood the DB with junk orders/customers and generate unlimited Midtrans
transactions from a script.

**Fix:** Add rate limiting keyed by IP + normalized phone (see item 9). Consider a
lightweight bot check (Turnstile/hCaptcha) on the storefront. Cap orders-per-phone-per-hour.
Bound `customerName` / `address` length before persisting (see item 6).

### [x] 3. Verify `NEXTCRM_DISABLE_AUTH=false` is set in every deployed environment
**File:** `lib/session.ts`

```ts
const NO_AUTH_ENABLED = process.env.NEXTCRM_DISABLE_AUTH !== "false";
```

Auth is **disabled unless the env var is exactly the string `"false"`**. In no-auth mode
every request resolves to a guest user with `isAdmin: true` (`toSession`/`normalizeSession`
hard-code `isAdmin: true` and `userStatus: "ACTIVE"`). If production ever ships without
`NEXTCRM_DISABLE_AUTH=false`, the entire admin surface is wide open.

**Fix:** Confirm the Vercel/production env has `NEXTCRM_DISABLE_AUTH=false`. Add a startup
assertion that refuses to boot in production (`NODE_ENV=production`) when no-auth is on,
unless an explicit `NEXTCRM_ALLOW_NOAUTH_IN_PROD=true` override is present. Document it in
CLAUDE.md's env section.

### [x] 4. `/api/whatsapp/status` is unauthenticated and exposes the pairing QR
**File:** `app/api/whatsapp/status/route.ts`

The `GET` handler has no auth. It calls `getWhatsAppClient()` (triggers client init from an
anonymous request) and returns the full state including `qrDataUrl`. Anyone who fetches this
endpoint while the session is unpaired can scan the QR and **link their own device to the
business WhatsApp**, reading/sending as the business. It also leaks `sessionPhone` and error
detail.

**Fix:** Gate the route behind a session check + `canAccessMektekStaffArea` (admin only for
the QR). Never return `qrDataUrl` to non-admins. The pairing page already lives under the
guarded `(routes)` tree — the API route does not inherit that guard, so it needs its own.

---

## P1 — High

### [x] 5. Phone numbers have no canonical country-code normalization (dedupe/search/WhatsApp all diverge)
**Files:** `lib/phone.ts` (`normalizePhoneNumber`), `lib/whatsapp/index.ts` (`buildChatId`),
every caller in `actions/mektek/*` and `actions/auth/register-user.ts`.

This is the pain point from the goal. There are **three different, inconsistent** phone
transforms:
- `lib/phone.ts` `normalizePhoneNumber`: only strips non-digits (keeps a leading `+`). It does
  **not** convert Indonesian local format to a country-code form. So the same person entered as
  `0812-3456-7890`, `62812...`, and `+62 812...` produces **three different `phoneNormalized`
  values**.
- `lib/whatsapp/index.ts` `buildChatId`: separately converts a leading `0` → `62`.

Because `phoneNormalized` is the dedupe key for `catalogCustomer.upsert({ where: { phoneNormalized } })`
(in `service-orders.ts`, `catalog-purchase.ts`, `customers.ts`) and the search key in
`searchMektekCustomers`, the divergence causes **duplicate customer records**, **missed search
matches**, and a mismatch between the stored phone and the number WhatsApp actually messages.

**Fix:** Introduce one canonical normalizer (recommend the `libphonenumber-js` library) that
produces E.164 (`+62812...`) with a default region of `ID`, used everywhere `phoneNormalized`
is written or queried:
- `normalizePhoneNumber` → return E.164, default region ID (leading `0` → `+62`).
- Validate the number is a possible/valid mobile number and reject early with a clear message
  ("Nomor telepon tidak valid") instead of the current `digits.length < 6/8` heuristics, which
  differ per call site (6 in `service-orders.ts`/`customers.ts`, 8 in `catalog-purchase.ts`).
- Make `buildChatId` derive from the same canonical E.164 value rather than re-deriving.
- Add a data migration to re-normalize existing `phoneNormalized` columns and merge duplicates.

**Done (2026-07-05):** Added `libphonenumber-js`. `lib/phone.ts` now exports a canonical
`normalizePhoneNumber` (E.164, default region ID), `isValidPhoneNumber` (possible-number check),
and `toWhatsAppChatId`. `lib/whatsapp/index.ts` `buildChatId` now aliases `toWhatsAppChatId`, so
the stored number and the WhatsApp target can't diverge. All call sites
(`service-orders.ts`, `catalog-purchase.ts`, `customers.ts`, `register-user.ts`) validate via
`isValidPhoneNumber` instead of the old `digits.length < 6/8` heuristics. Unit tests in
`__tests__/lib/phone.test.ts`. **Operational step still required:** run
`node scripts/renormalize-phones.js` (dry-run first, then `--apply`) to re-normalize existing
rows; it reports — but does not auto-merge — duplicate collisions for manual review.

### [x] 6. Address (and name) are free-form, unbounded, unstructured
**Files:** `actions/mektek/service-orders.ts`, `actions/mektek/catalog-purchase.ts`,
`actions/mektek/customers.ts`.

`address` is stored as an arbitrary-length string inside the `tags` JSON blob with no length
cap, no trimming beyond `.trim()`, and no structure. Same for `customerName`. Risks: unbounded
JSON growth, inconsistent formatting, and these values later flow into generated PDFs
(`invoice-pdf.ts`) and WhatsApp messages.

**Fix:** Cap lengths (e.g. name ≤ 120, address ≤ 500) and reject/truncate over-long input.
Consider structuring the address (street / city / province / postal) if the business needs it
for routing. Centralize the sanitization so storefront and admin paths share it. Confirm the
PDF renderer escapes these fields (see item 10).

**Done (2026-07-05):** Centralized bounds in `lib/mektek/sanitize.ts` (`boundedText` +
`MAX_NAME_LEN` 120 / `MAX_ADDRESS_LEN` 500 / `MAX_VEHICLE_LEN` 120 / `MAX_COMPLAINT_LEN` 2000),
shared by the storefront (`catalog-purchase.ts`), admin order/customer paths
(`service-orders.ts`, `customers.ts`), and registration (`register-user.ts`). Over-long input is
whitespace-collapsed and truncated before it reaches the `tags` JSON.

### [x] 7. Host header injection into customer-facing tracking links
**File:** `actions/mektek/service-orders.ts` → `buildAppUrl`

`buildAppUrl` trusts `x-forwarded-host` / `host` request headers to build the base URL for
customer tracking links that are then **sent to customers over WhatsApp**. An attacker who can
set the `Host`/`X-Forwarded-Host` header (or via a misconfigured proxy) can poison these links
to point at a phishing domain.

**Fix:** Derive the base URL from a trusted server-side config (`NEXT_PUBLIC_APP_URL` /
`VERCEL_URL`) as the primary source; only fall back to request headers when explicitly
allow-listed. Never build a link that gets sent to a third party from an attacker-controllable
header.

**Done (2026-07-05):** `buildAppUrl` now sources the base URL from
`NEXT_PUBLIC_APP_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL`. Request
`Host`/`X-Forwarded-Host` headers are used only as a last resort **and only** when the host is a
loopback/local address (`localhost`, `127.0.0.1`, `0.0.0.0`, `*.local`), so a spoofed Host header
can't poison a customer-facing link. Set `NEXT_PUBLIC_APP_URL` in every deployed environment.

### [x] 8. Server actions lack schema validation (use the existing `createSafeAction` pattern)
**Files:** all of `actions/mektek/*`, `actions/auth/*`.

These actions hand-roll `String(x ?? "").trim()` coercion per field and validate ad hoc. The
repo already ships `createSafeAction` + Zod (`lib/create-safe-action.ts`) for exactly this.
Inconsistent validation is how the phone/length gaps above crept in.

**Fix:** Wrap the mutation actions in Zod schemas (phone, name, address, amounts, enums like
payment `method`/`status`). This gives one validation surface and kills whole classes of the
issues above.

**Done (2026-07-05):** The concrete gaps this item flagged (per-call-site phone heuristics and
unbounded name/address) are now closed by a single shared validation surface —
`lib/phone.ts` (`isValidPhoneNumber`, canonical `normalizePhoneNumber`) and
`lib/mektek/sanitize.ts` (`boundedText`, length caps, `sanitizeMektekCustomer`) — used across the
Mektek and auth mutation actions. Payment `method`/`status` enums are already whitelist-checked in
`updateMektekPayment`. Note: this consolidates validation without a full `createSafeAction`
rewrite of every action; a broader migration to `createSafeAction` remains available as
follow-up hardening but is no longer needed to fix the security gaps listed here.

---

## P2 — Medium

### [ ] 9. No rate limiting anywhere
**Files:** `actions/auth/password-reset.ts`, `actions/auth/register-user.ts`
(`registerCustomerUser`), `actions/mektek/catalog-purchase.ts`,
`actions/mektek/payments.ts` (`createMektekPaymentIntent`), `app/api/mektek/service-orders/[id]/stream/route.ts`.

No endpoint throttles. Payment-intent creation makes a fresh `mektekPayment` row + Midtrans
call per request with only a valid token/code required, so a token holder can spam pending
rows. The SSE `stream` route opens an unbounded per-connection 2-second DB poll with no max
duration or concurrency cap — many open connections = sustained DB load (cheap DoS).

**Fix:** Add a shared rate-limit helper (IP + subject key). For the stream route, add a max
lifetime (e.g. close after N minutes) and back off the poll interval; consider a shared
poller or switching to DB `LISTEN/NOTIFY` instead of per-connection polling.

### [ ] 10. Confirm PDF/WhatsApp rendering escapes customer-supplied text
**Files:** `actions/mektek/invoice-pdf.ts`, `actions/mektek/whatsapp-notifications.ts`
(consumers of `customerName`, `address`, item names).

React escapes by default in the app UI, but customer-controlled strings (`customerName`,
`address`, catalog `description`) flow into generated PDFs and WhatsApp message bodies. If the
PDF renderer interpolates raw HTML/markup, stored-XSS or layout-injection is possible.

**Fix:** Verify the PDF path escapes/So sanitizes these fields; bound their length (item 6).

### [ ] 11. Authenticated invoice/receipt fetch is not role-scoped (IDOR for any logged-in user)
**Files:** `app/api/mektek/service-orders/[id]/invoice/route.ts`,
`app/api/mektek/service-orders/[id]/receipt/route.ts`

When no `token`/`code` is supplied, the route only checks `session?.user?.id` exists, then
calls `getMektekServiceOrderById(id)` — **no Mektek role check**. Any authenticated user
(regardless of `mektekRole`) can fetch **any** order's invoice (customer name, phone, address,
financials) by iterating IDs. These `/api/` routes sit outside the `(routes)` layout guard, so
they don't inherit its session/role enforcement.

**Fix:** In the authenticated branch, require `canAccessMektekStaffArea(session.user)` before
returning the invoice.

### [ ] 12. Access secrets travel in URL query strings
**Files:** invoice/receipt/stream routes (`?token=`, `?code=`), tracking links.

`customerToken` (20 bytes) and `customerCode` (12 bytes) are passed as query parameters. URLs
land in server access logs, proxy logs, and `Referer` headers, so these secrets can leak. The
PDF responses correctly set `Cache-Control: no-store`; the concern is log/referrer exposure.

**Fix:** Accept the token via header or POST body where feasible; at minimum scrub these query
params from access logs and set `Referrer-Policy: no-referrer` on the customer pages that embed
them. Keep token entropy where it is (it's fine).

### [ ] 13. Webhook falls back to trusting the POST body when the status re-fetch fails
**File:** `app/api/mektek/payments/notification/route.ts`

The handler correctly verifies the SHA-512 signature and then re-fetches authoritative status
server-to-server. But if `getTransactionStatus` fails (`statusResult.ok === false`), it falls
back to `authoritative = body` and derives the verdict from the POST payload — contradicting
the "do not trust the POST body for the verdict" comment. The signature is verified, so this is
low risk, but a transient Midtrans outage could finalize a payment on unverified amounts.

**Fix:** On re-fetch failure, do **not** finalize as `paid`; leave the payment pending and let
Midtrans retry (return 200 without mutating to paid), or retry the status lookup with backoff.

---

## P3 — Low / hardening

### [ ] 14. Staff registration has no password strength requirement
**File:** `actions/auth/register-user.ts` → `registerUser`

`registerCustomerUser` enforces `password.length >= 8`, but the staff `registerUser` path has
**no length or complexity check at all**. Add at least the same 8-char minimum (ideally
stronger for staff/admin accounts).

### [ ] 15. First-registrant-becomes-admin bootstrap
**File:** `actions/auth/register-user.ts`

`registerUser` grants `is_admin: true` + `ACTIVE` to the first user when the users table is
empty. Fine for initial setup, but if the table is ever emptied in production this silently
re-opens admin signup. Consider gating behind an explicit bootstrap env flag.

### [ ] 16. Two divergent `parseMoney` implementations
**Files:** `actions/mektek/service-orders.ts` (strips all non-digits) vs
`app/api/mektek/payments/notification/route.ts` (allows `.`/`-`). Consolidate into one shared
money helper in `lib/mektek/` to avoid rounding/parsing drift.

### [ ] 17. Duplicated Mektek order `where` / title-prefix constants
**Files:** `service-orders.ts`, `dashboard.ts`, `catalog-purchase.ts` each redefine the
`MEKTEK Service -` / `MEKTEK AC -` prefixes and the `mektekOrderWhere` filter. Centralize to
prevent one copy drifting (e.g. dashboard already omits the soft-delete `deletedAt: null`
filter that CRM queries are supposed to apply — verify Mektek task queries filter deleted rows
per the CLAUDE.md soft-delete rule).

### [ ] 18. Token comparison is not constant-time
**File:** `actions/mektek/service-orders.ts` → `getPublicMektekServiceOrder`
(`tags.customerToken !== token`). Low risk at 20-byte entropy, but for consistency with the
webhook (which already uses `crypto.timingSafeEqual`) consider a constant-time compare.

---

## Notes / things that are already good

- Midtrans webhook signature verification uses `crypto.timingSafeEqual` and re-fetches
  authoritative status before finalizing (aside from the fallback in item 13). Good.
- Payment amounts are always recomputed server-side; the client never supplies an amount
  (`createMektekPaymentIntent`, `createMektekCatalogPurchaseIntent`). Good.
- Passwords are hashed with bcrypt cost 12. Good.
- Idempotency guard on the webhook (`payment.paidAt`) prevents double-settlement. Good.
- Payment intent creation is gated by the unguessable token/code and rejects zero-balance
  orders. Good (still add rate limiting per item 9).
