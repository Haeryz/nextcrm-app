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

**Update 2026-07-15 — mechanism changed, finding still closed.** The WhatsApp transport moved to
Baileys (`docs/whatsapp-on-vercel.md`), so the description above no longer matches the code:
`getWhatsAppClient()` is gone, and `/api/whatsapp/status` is now **read-only** — it cannot start a
session and never carries a QR. The QR moved to `app/api/whatsapp/pair/route.ts`, which is
**admin-only** and re-checks admin itself rather than trusting the page guard; `/api/whatsapp/logout`
is likewise admin-only and POST (so it can't be triggered by a prefetch or an `<img>` tag). Status
remains staff-gated and still strips `lastError` for non-admins.

Newly relevant to this finding: the paired credentials are now stored in Postgres
(`WhatsAppSession.credsCipher`) rather than a Chromium profile on disk. They grant full
send-as-the-business access, so they are encrypted at rest with AES-256-GCM (`lib/crypto/secret-box.ts`)
under `EMAIL_ENCRYPTION_KEY` — a database dump alone does not yield a usable session. Signal key
material in `WhatsAppSignalKey` is encrypted the same way.

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
`updateMektekPayment` (which lives in `actions/mektek/service-orders.ts`; `status` is
server-derived from amounts, not client input). Note: this consolidates validation without a full `createSafeAction`
rewrite of every action; a broader migration to `createSafeAction` remains available as
follow-up hardening but is no longer needed to fix the security gaps listed here.

---

## P2 — Medium

### [x] 9. No rate limiting anywhere
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

**Done (2026-07-06):** All listed endpoints now throttle via the shared
`lib/rate-limit.ts` helper (`checkRateLimit` + `getClientIp`, IP + subject key). Newly
covered this pass: `registerUser` (IP, 5/15min) and `registerCustomerUser` (IP + phone,
5/15min) in `register-user.ts`, and `createMektekPaymentIntent` (IP + service order, 8/10min)
in `payments.ts`. `password-reset.ts` and `catalog-purchase.ts` were already limited (catalog-purchase uses a
10-min window).
The SSE `stream` route now caps lifetime at 10 min (client auto-reconnects), backs the poll
interval off from 2s → 15s while the snapshot is unchanged (resets to 2s on activity), and
sheds load with a 503 + `Retry-After` once `MAX_CONCURRENT` (200) streams are open per instance.
The in-memory limiter is per-instance (documented in `lib/rate-limit.ts`); back it with
Redis/Upstash for cross-instance guarantees later.

### [x] 10. Confirm PDF/WhatsApp rendering escapes customer-supplied text
**Files:** `actions/mektek/invoice-pdf.ts`, `actions/mektek/whatsapp-notifications.ts`
(consumers of `customerName`, `address`, item names).

React escapes by default in the app UI, but customer-controlled strings (`customerName`,
`address`, catalog `description`) flow into generated PDFs and WhatsApp message bodies. If the
PDF renderer interpolates raw HTML/markup, stored-XSS or layout-injection is possible.

**Fix:** Verify the PDF path escapes/So sanitizes these fields; bound their length (item 6).

**Done (2026-07-06):** Confirmed safe by construction — no code change needed.
- **PDF:** `invoice-pdf.ts` renders exclusively through `@react-pdf/renderer` primitives
  (`<Text>`/`<View>` via `React.createElement`). `<Text>` draws its children as literal glyphs;
  there is no HTML/markup parser in the PDF pipeline, so `customer.name`, `address`, and item
  `name`/`sku` cannot inject markup or break layout beyond wrapping. No raw-string HTML
  interpolation exists anywhere in the renderer.
- **WhatsApp:** `whatsapp-notifications.ts` builds message bodies with a plain `String.replace`
  template (`applyTemplate`) and sends them as plaintext via whatsapp-web.js — no HTML sink.
- Lengths of `customerName`/`address` are already bounded at write time by
  `lib/mektek/sanitize.ts` (item 6), so unbounded-growth layout abuse is also closed.

### [x] 11. Authenticated invoice/receipt fetch is not role-scoped (IDOR for any logged-in user)
**Files:** `app/api/mektek/service-orders/[id]/invoice/route.ts`,
`app/api/mektek/service-orders/[id]/receipt/route.ts`

When no `token`/`code` is supplied, the route only checks `session?.user?.id` exists, then
calls `getMektekServiceOrderById(id)` — **no Mektek role check**. Any authenticated user
(regardless of `mektekRole`) can fetch **any** order's invoice (customer name, phone, address,
financials) by iterating IDs. These `/api/` routes sit outside the `(routes)` layout guard, so
they don't inherit its session/role enforcement.

**Fix:** In the authenticated branch, require `canAccessMektekStaffArea(session.user)` before
returning the invoice.

**Done (2026-07-06):** Both routes' authenticated branch now goes through
`requireMektekStaffApiSession()` (`lib/api-gates.ts`), which returns 401 for anonymous and 403
for any session that fails `canAccessMektekStaffArea` — so a logged-in non-staff user can no
longer enumerate other orders' invoices. The token/code branches are unchanged (still gated by
the unguessable per-order secret).

### [x] 12. Access secrets travel in URL query strings
**Files:** invoice/receipt/stream routes (`?token=`, `?code=`), tracking links.

`customerToken` (20 bytes) and `customerCode` (12 bytes) are passed as query parameters. URLs
land in server access logs, proxy logs, and `Referer` headers, so these secrets can leak. The
PDF responses correctly set `Cache-Control: no-store`; the concern is log/referrer exposure.

**Fix:** Accept the token via header or POST body where feasible; at minimum scrub these query
params from access logs and set `Referrer-Policy: no-referrer` on the customer pages that embed
them. Keep token entropy where it is (it's fine).

**Done (2026-07-06):** Closed the `Referer`-leak vector (the practical exposure).
`Referrer-Policy: no-referrer` is now set on:
- the customer tracking pages that carry the secret — `/:locale/s/:path*` and
  `/:locale/service-status/:path*` — via `next.config.js` `headers()`, so an outbound link or
  embedded resource from those pages never carries the token in a `Referer`; and
- the `invoice`, `receipt`, and `stream` API responses (which already set `Cache-Control:
  no-store`).
Token entropy is unchanged (fine, per note). Access-log scrubbing of query params is a
deploy/proxy-layer concern (Vercel/CDN log config) rather than app code and is out of scope for
this repo; the referrer defense above removes the browser-side leak. Moving the secret to a
header/POST body would require reworking the `<a href>`-based PDF download + `EventSource`
stream (which can only pass state via URL), so it was deliberately not pursued.

### [x] 13. Webhook falls back to trusting the POST body when the status re-fetch fails
**File:** `app/api/mektek/payments/notification/route.ts`

The handler correctly verifies the SHA-512 signature and then re-fetches authoritative status
server-to-server. But if `getTransactionStatus` fails (`statusResult.ok === false`), it falls
back to `authoritative = body` and derives the verdict from the POST payload — contradicting
the "do not trust the POST body for the verdict" comment. The signature is verified, so this is
low risk, but a transient Midtrans outage could finalize a payment on unverified amounts.

**Fix:** On re-fetch failure, do **not** finalize as `paid`; leave the payment pending and let
Midtrans retry (return 200 without mutating to paid), or retry the status lookup with backoff.

**Done (2026-07-06):** The `authoritative = body` fallback is removed. On
`statusResult.ok === false` the handler now logs and returns `200 { ok: true, note:
"Status re-fetch failed; left pending" }` **without mutating the payment** — the row stays
pending and Midtrans retries the notification later (Midtrans retries non-finalized webhooks).
No verdict is ever derived from the POST body now; the only mutation path is the
signature-verified re-fetch succeeding.

---

## P3 — Low / hardening

### [x] 14. Staff registration has no password strength requirement
**File:** `actions/auth/register-user.ts` → `registerUser`

`registerCustomerUser` enforces `password.length >= 8`, but the staff `registerUser` path has
**no length or complexity check at all**. Add at least the same 8-char minimum (ideally
stronger for staff/admin accounts).

**Done (2026-07-06):** `registerUser` now enforces `password.length >= 8` and `<= 100`
(matching `registerCustomerUser`). Also added the missing upper bound (`<= 100`) to
`registerCustomerUser` so neither path can submit an unbounded password (bcrypt-hash DoS).

### [x] 15. First-registrant-becomes-admin bootstrap
**File:** `actions/auth/register-user.ts`

`registerUser` grants `is_admin: true` + `ACTIVE` to the first user when the users table is
empty. Fine for initial setup, but if the table is ever emptied in production this silently
re-opens admin signup. Consider gating behind an explicit bootstrap env flag.

**Done (2026-07-06):** Already resolved by design — the described pattern no longer exists.
Both `registerUser` and `registerCustomerUser` hard-code `is_admin: false` (verified: no
`users.count` / first-user branch in `register-user.ts`). Admin creation is exclusively via
`bootstrapFirstAdmin` (`actions/auth/bootstrap-admin.ts`, the `/setup` wizard), which
**self-disables** the moment `adminAccountExists()` returns true — a hard gate that also
defends against replay/race. Emptying the users table only re-enables the one-time `/setup`
flow, not silent admin signup through registration. No code change required.

### [x] 16. Two divergent `parseMoney` implementations
**Files:** `actions/mektek/service-orders.ts` (strips all non-digits) vs
`app/api/mektek/payments/notification/route.ts` (allows `.`/`-`). Consolidate into one shared
money helper in `lib/mektek/` to avoid rounding/parsing drift.

**Done (2026-07-06):** The notification route no longer parses money strings (that path was
refactored — the webhook trusts the DB `grossAmount` number and the re-fetched authoritative
status, never a string parse), so the divergence is gone. The remaining duplicate was an
identical `parseMoney` copy in `service-orders.ts`; it now imports the single shared
`parseMoney` from `lib/mektek/items.ts` (already used by `financials.ts`). One money helper
across the module.

### [x] 17. Duplicated Mektek order `where` / title-prefix constants
**Files:** `service-orders.ts`, `dashboard.ts`, `catalog-purchase.ts` each redefine the
`MEKTEK Service -` / `MEKTEK AC -` prefixes and the `mektekOrderWhere` filter. Centralize to
prevent one copy drifting (e.g. dashboard already omits the soft-delete `deletedAt: null`
filter that CRM queries are supposed to apply — verify Mektek task queries filter deleted rows
per the CLAUDE.md soft-delete rule).

**Done (2026-07-06):** New shared module `lib/mektek/orders.ts` exports
`MEKTEK_TITLE_PREFIX`, `LEGACY_MEKTEK_TITLE_PREFIX`, `MEKTEK_TITLE_PREFIXES`,
`mektekOrderWhere()`, and the shared `mektekPaymentSelect`. `service-orders.ts`, `dashboard.ts`,
and `catalog-purchase.ts` now import from it instead of redefining (dashboard's `where` object
became the shared `mektekOrderWhere()` function at all call sites). **Soft-delete check:**
verified against `prisma/schema.prisma` — `crm_Accounts_Tasks` has **no** `deletedAt`/`deletedBy`
column, so Mektek orders are not soft-deleted (they track state via `taskStatus`). The
CLAUDE.md soft-delete rule does not apply to these queries; this is documented in the new
module's header comment so the "missing `deletedAt: null`" observation doesn't get
re-introduced as a bug report.

### [x] 18. Token comparison is not constant-time
**File:** `actions/mektek/service-orders.ts` → `getPublicMektekServiceOrder`
(`tags.customerToken !== token`). Low risk at 20-byte entropy, but for consistency with the
webhook (which already uses `crypto.timingSafeEqual`) consider a constant-time compare.

**Done (2026-07-06):** `getPublicMektekServiceOrder` now compares via a `constantTimeEqual`
helper that SHA-256-hashes both the stored and supplied token and runs `crypto.timingSafeEqual`
on the fixed-length digests — constant-time regardless of input, and safe against
`timingSafeEqual`'s unequal-length throw. Empty/missing stored tokens still short-circuit to
`null`. Unit tests in `__tests__/mektek/public-order-token.test.ts` (exact match, wrong
same-length token, different-length token, missing token, missing id/token short-circuit).

---

# Round 2 — Audit 2026-07-06 (pre-production re-sweep)

> Verification pass: all 18 items above were re-checked against the code on 2026-07-06 and
> **all 18 are genuinely implemented** (two doc corrections: item 8's `updateMektekPayment`
> lives in `actions/mektek/service-orders.ts`, not `payments.ts`; item 9's catalog-purchase
> window is 10 min, not 15).
>
> The items below are **new findings** from a full re-sweep of every `app/api/**/route.ts`
> handler and every `actions/**` `"use server"` file. Nothing here is fixed yet. Same rules
> as above: fix, test (Jest + curl/Playwright), then check the box.

## P0 — Critical

### [x] 19. Customer account takeover via unverified phone linking (IDOR / broken auth)
**Files:** `actions/auth/register-user.ts` (`registerCustomerUser`, lines ~180-197),
`actions/mektek/customer-profile.ts` (`getMektekCustomerProfile`, lines ~62-118)

`registerCustomerUser` upserts `catalogCustomer` keyed on `phoneNormalized` and sets
`userId: createdUser.id`. The only pre-check is that no **Users** row already owns that phone —
a walk-in `catalogCustomer` created by staff has no linked user, so it is claimable by anyone.
`getMektekCustomerProfile` then matches the customer by `OR: [{ userId }, { phoneNormalized }]`,
**auto-links** `userId` if empty, and returns every `serviceLink` including the `customerToken`,
invoice/receipt/stream hrefs, address, and payment history.

**Attack:** register a customer account with a *victim's* phone number (there is no OTP or any
phone-ownership verification anywhere). Registration silently binds the victim's existing
`catalogCustomer` — full service history, access tokens, PII — to the attacker's account.
This is the live customer-facing surface.

**Fix (decided: WhatsApp OTP, reusing the existing whatsapp-web.js integration):**
1. New Prisma model `customerPhoneVerification` (`phoneNormalized @unique`, `codeHash`,
   `expiresAt`, `attempts Int @default(0)`, `consumedAt`, `createdAt`) + migration.
2. New `actions/auth/phone-otp.ts`:
   - `requestCustomerPhoneOtp(phone)` — validate via `isValidPhoneNumber`/`normalizePhoneNumber`
     (`lib/phone.ts`); rate-limit via `checkRateLimit`/`getClientIp` (`lib/rate-limit.ts`), IP
     5/15min + phone 3/15min; 6-digit code from `crypto.randomInt`; store SHA-256 hash, 5-min
     TTL, upsert per phone; send via `sendWhatsAppMessage` (`lib/whatsapp/index.ts`).
     When `areExternalApisDisabled()` or the WhatsApp session isn't `ready`: in dev, log the
     code to the server console and return success (keeps local flow testable); in production
     return an error ("Verifikasi WhatsApp sedang tidak tersedia") — **fail closed**, never
     skip verification.
   - Internal `verifyOtpCode(phoneNormalized, code)` helper (NOT exported as an action):
     expiry + `attempts < 5` (increment on failure), constant-time compare (SHA-256 both sides
     + `crypto.timingSafeEqual`, same pattern as `constantTimeEqual` in `service-orders.ts`),
     set `consumedAt` on success (single-use).
3. `registerCustomerUser` takes a required `otpCode` and verifies it before the transaction.
4. `getMektekCustomerProfile`: look up by `{ userId: user.id }` **only** — delete the
   `phoneNormalized` fallback and the auto-link block. Linking happens only at OTP-verified
   registration or via the claim action below.
5. New `claimMektekCustomerByPhone(otpCode)` (preserves the walk-in-history feature the
   auto-link provided): logged-in user verifies OTP to their phone; on success, link the
   **unclaimed** (`userId: null`) `catalogCustomer` with matching `phoneNormalized`. Refuse if
   already linked to another user. Profile action returns a `claimAvailable: true` flag (never
   record data pre-verification); profile page shows a "verify phone to see your service
   history" prompt.
6. UI: registration form under `app/[locale]/customer/access/` gets a "Kirim kode" button +
   code input.
7. **Deploy notes:** run the migration on Neon (`pnpm prisma migrate deploy`); production
   WhatsApp session must be paired or self-registration is unavailable (by design). Document
   the OTP dependency in CLAUDE.md.

**Done (2026-07-06):** Implemented as specified. New Prisma model `CustomerPhoneVerification`
(+ migration `20260706000000_customer_phone_verification`). `lib/otp.ts` is a **plain
server-only module** (not `"use server"`, so `verifyOtpCode` is never a browser-reachable
action): `issueOtpCode` stores only a SHA-256 hash (5-min TTL, one row per phone via upsert);
`verifyOtpCode` enforces expiry, single-use (`consumedAt`), ≤5 attempts (incremented per wrong
guess), and constant-time compare. `actions/auth/phone-otp.ts` `requestCustomerPhoneOtp`
rate-limits IP 5/15min + phone 3/15min, sends via `sendWhatsAppMessage`, and **fails closed in
production** when WhatsApp is unavailable (dev logs the code so local flow stays testable).
`registerCustomerUser` now requires `otpCode` and verifies it before the create transaction.
`getMektekCustomerProfile` matches by `{ userId }` **only** — the `phoneNormalized` OR-fallback
and the silent auto-link block are gone — and returns `claimAvailable` without any record data.
New `claimMektekCustomerByPhone(otpCode)` re-links an unclaimed (`userId: null`) walk-in record
only after OTP, refusing records already linked to another user. UI: OTP field + "Kirim kode"
on both registration forms (`customer/access` and `/register`), plus a `CustomerClaimCard`
verify-to-claim prompt on the profile page. Tests: `__tests__/lib/otp.test.ts` (7 cases).
**Deploy:** `pnpm prisma migrate deploy` on Neon; production WhatsApp session must be paired.

### [x] 20. Bcrypt password hash returned to the client
**File:** `actions/auth/register-user.ts` (lines ~87 and ~202)

Both `registerUser` and `registerCustomerUser` end with `return { data: user }` — the full
Prisma `users` row from `create()`, **including the bcrypt `password` hash**, phone, and
internal flags. Server-action return values are serialized to the browser.

**Fix:** return only safe fields (`{ data: { id, email, name } }`). Check the registration
form components' usage of the return value first so nothing breaks.

**Done (2026-07-06):** Both `registerUser` and `registerCustomerUser` now
`return { data: { id, email, name } }` — the bcrypt hash, phone, and internal flags no longer
cross the server-action boundary. Verified both consumers (`CustomerAccessForm`,
`/register` `RegisterComponent`) only read `result.error`/`result.data` as `{id,email,name}`,
so nothing broke.

## P1 — High

### [x] 21. No global security headers (clickjacking; missing nosniff/HSTS)
**File:** `next.config.js` (`headers()`, currently only sets `Referrer-Policy` on two paths)

No `X-Frame-Options` or CSP `frame-ancestors` anywhere — the entire admin panel and customer
portal can be iframed (clickjacking). Also missing `X-Content-Type-Options: nosniff`,
`Strict-Transport-Security`, `Permissions-Policy`; `poweredByHeader` is left on.

**Fix:** add a `source: "/:path*"` headers entry with `X-Frame-Options: DENY`,
`Content-Security-Policy: frame-ancestors 'none'` (frame-ancestors **only** — a full CSP would
break Next inline scripts + Midtrans Snap; defer that), `X-Content-Type-Options: nosniff`,
`Strict-Transport-Security: max-age=63072000; includeSubDomains`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`, and a global
`Referrer-Policy: strict-origin-when-cross-origin`. Set `poweredByHeader: false`. Keep the
existing `no-referrer` entries for `/:locale/s/:path*` and `/:locale/service-status/:path*`
and verify they still win on those paths (Next applies all matching entries; last-set wins per
header — check ordering).

**Done (2026-07-06):** `next.config.js` `headers()` now emits a global `source: "/:path*"`
entry with `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`
(frame-ancestors only — full CSP deferred so Next inline scripts + Midtrans Snap keep working),
`X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=63072000;
includeSubDomains`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and
`Referrer-Policy: strict-origin-when-cross-origin`. `poweredByHeader: false` removes
`X-Powered-By`. The two `no-referrer` entries are kept and ordered **after** the global entry
so they still win on the token-bearing tracking paths.

### [x] 22. `"use server"` exports with no internal authorization (worst case: arbitrary WhatsApp send)
**Files:** `actions/mektek/service-orders.ts` (`getMektekServiceOrders` ~:648,
`getMektekServiceOrderById` ~:709), `actions/mektek/dashboard.ts`
(`getMektekDashboardSummary` :13), `actions/mektek/whatsapp-notifications.ts`
(`notifyMektekOrderCreated` :63, `notifyMektekOrderCompleted` :87)

Every exported function in a `"use server"` module is a server-action endpoint that must
authorize independently. These have **no session/role check**:
- `getMektekServiceOrders` / `getMektekServiceOrderById` — list/fetch any order incl.
  `tags.customerToken`, phone, address.
- `getMektekDashboardSummary` — full financials (compare `canViewMektekDashboard`, which is
  admin-only but not enforced here).
- `notifyMektekOrderCreated`/`notifyMektekOrderCompleted` — send WhatsApp messages + PDFs to a
  **caller-supplied** phone (`params.order.tags.phone`) → arbitrary spam/phishing from the
  business number.

Currently not imported by any `"use client"` component, so the action IDs aren't published to
the browser — but one client import away from being live endpoints. Fix now as defense-in-depth.

**Fix:**
- Gate `getMektekServiceOrders`/`getMektekServiceOrderById` with session +
  `canAccessMektekStaffArea` (same pattern as the gated mutations in the same file). Note the
  invoice/receipt API routes call `getMektekServiceOrderById` **after** their own gate — either
  refactor them onto an ungated internal (non-exported) fetch or accept the double check
  (token/code branches must keep working for anonymous customers, so don't let the new gate
  break those routes' token path).
- Gate `getMektekDashboardSummary` with `canViewMektekDashboard`
  (`lib/mektek/permissions.ts`).
- `whatsapp-notifications.ts`: **remove `"use server"`** — it's an internal helper called from
  `service-orders.ts` and `catalog-purchase.ts` (customer checkout calls it, so a staff gate
  would break checkout). Verified no client component imports it; dropping the directive makes
  it a plain server module instead of an endpoint.
- `listMektekCatalogItems` (`catalog-items.ts` ~:144) is intentionally public (storefront) —
  leave as is.

**Done (2026-07-06):** `getMektekServiceOrders` and `getMektekServiceOrderById`
(`service-orders.ts`) now authorize via `getServerSession` + `canAccessMektekStaffArea`. The
list action throws `Forbidden`; the by-id action returns `null` (preserving its `order|null`
contract so the invoice/receipt routes — which pre-gate with `requireMektekStaffApiSession` —
and the detail page keep working; anonymous customer PDF access uses
`getPublicMektekServiceOrder*`, not this path). `getMektekDashboardSummary` (`dashboard.ts`)
throws unless `canViewMektekDashboard`. `whatsapp-notifications.ts` dropped its `"use server"`
directive (now `import "server-only"`) so `notifyMektekOrderCreated`/`notifyMektekOrderCompleted`
are internal helpers, not network-invocable actions — closing the arbitrary-WhatsApp-send
vector. Authorization tests added in `__tests__/mektek/dashboard.test.ts`.

## P2 — Medium / hardening

### [x] 23. `userStatus` not enforced in action/API gates (suspended staff keep working sessions)
**Files:** `lib/auth.ts` (~:90-157), `lib/api-gates.ts`, Mektek action guards in
`actions/mektek/*`

`lib/auth.ts` builds a full session (with `isAdmin`/`mektekRole`) regardless of `userStatus`.
Status is only enforced by `requireUser()` page redirects (`lib/auth-guards.ts`); the Mektek
server actions and `requireMektekStaffApiSession` check role but not status, so a
`PENDING`/`INACTIVE` (suspended) user's still-valid JWT keeps working against server actions
and API routes.

**Fix:** reject non-`ACTIVE` users centrally — in `requireMektekStaffApiSession`
(`lib/api-gates.ts`, return 403) and in a shared helper used by the Mektek action guards.
Keep `lib/session.ts` no-auth/guest mode behavior intact (guest is hard-coded ACTIVE).

**Done (2026-07-06):** Centralized in the one surface both sides already authorize through:
`lib/mektek/permissions.ts` predicates now AND in a shared `isActive(user)` gate
(`userStatus === "ACTIVE"`; missing status treated as inactive). Because the Mektek server
actions call `can*(session.user)` and `requireMektekStaffApiSession` /
`requireMektekCustomerToolApiSession` call `canAccessMektekStaffArea` /
`canUseMektekCustomerTools`, a suspended (PENDING/INACTIVE) user's still-valid JWT is now
rejected everywhere — 403 at the API gates, `Forbidden` in the actions — without editing each
action. The no-auth guest session is hard-coded `userStatus: "ACTIVE"` (`lib/session.ts`), so
local no-auth dev is unaffected. `__tests__/mektek/permissions.test.ts` fixtures updated + a
suspended-staff denial test added.

### [x] 24. No rate limit on PDF invoice/receipt generation (CPU DoS by a token holder)
**Files:** `app/api/mektek/service-orders/[id]/invoice/route.ts`, `.../receipt/route.ts`

Both call `renderToBuffer` (CPU-heavy) with no throttle. Token/code entropy makes brute-force
infeasible, so it's not an access issue — but a legitimate link holder can hammer it.

**Fix:** `checkRateLimit` keyed `pdf:{ip}:{orderId}` (e.g. 15/10min), 429 + `Retry-After` on
exceed (mirror the stream route's load-shedding style).

**Done (2026-07-06):** Both routes (`invoice`, `receipt`) now call
`checkRateLimit("pdf:{ip}:{id}", 15, 10*60*1000)` (via `lib/rate-limit.ts` + `getClientIp`)
immediately after parsing params — before any auth branch or `renderToBuffer` — and return
`429` with `Retry-After` (seconds, from `retryAfterMs`) + `Referrer-Policy: no-referrer` when
exceeded. Applies to the anonymous token/code branches and the staff branch alike. (Limiter is
per-instance; back with Redis for cross-instance guarantees later, as already noted for item 9.)

## Round 2 — verified OK (no action needed)
- `.env` not git-tracked (only `.env.example`/`.env.production.example`); `.gitignore` covers
  `.env*`. No committed secrets.
- Midtrans notification route: signature verified, authoritative re-fetch, idempotent, no
  body-trust path.
- Stream route: token-authorized, capped (lifetime/backoff/concurrency), snapshot strips PII.
- Invoice/receipt: staff gate on the no-token branch; token/code branches sound.
- Admin-side Mektek actions (`catalog-items`, `customers`, order mutations, `payments`):
  correctly role-gated, input bounded, amounts server-computed, no mass assignment; protected
  accounts can't be edited/deleted, no self-delete.
- No SSRF (no user-supplied URL fetches; Midtrans endpoints fixed), no path traversal
  (`lib/catalog-images.ts` blocks `..`), no state-changing GET handlers (CSRF), no MCP/Inngest/
  cron/upload route handlers exist in this deployment.
- No root `middleware.ts` — auth is layout-guard + per-action gates only. Everything under
  `app/[locale]/customer/*`, `/s/*`, `/service-status/*` is outside the layout guard and relies
  on per-action checks — which is exactly why items 19 and 22 matter. Optional follow-up:
  add middleware as defense-in-depth.

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
