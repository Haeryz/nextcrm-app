# WhatsApp on Vercel (no VM, no official API)

How the Mektek WhatsApp integration runs on serverless, why it is shaped the way it is, and —
importantly — **what has and has not actually been proven to work**.

Read [Verification status](#verification-status) and [Known limitations and risks](#known-limitations-and-risks)
before trusting this in production or debugging it.

---

## 1. The problem

Mektek sends three kinds of WhatsApp message: new-order notification, order-completed (with
invoice + struk PDFs), and the customer login OTP. All of it worked locally and was dead in
production on `mektek-bice.vercel.app`.

The cause was structural, not a bug. The old transport was **whatsapp-web.js**, which automates a
real Chromium through Puppeteer and keeps a long-lived browser plus WebSocket alive. Vercel
functions are ephemeral, have a read-only filesystem (except `/tmp`), and share no memory between
instances. Three independent things broke:

1. **Chromium cannot run there.** `LocalAuth` persists an entire Chromium user-data directory
   (LevelDB, IndexedDB, lock files) that a serverless function cannot hold.
2. **`globalThis.whatsappClient` assumed one process.** Each poll of `/api/whatsapp/status` could
   land on a different instance, so a QR would never reliably reach the admin polling for it.
3. **Nothing survives the response.** The session died when the invocation ended.

Constraints on the fix: **no official WhatsApp Cloud API, and no separate VM or server.** It had
to work on the Vercel deployment itself.

## 2. Why the usual answer doesn't apply

Search for "Baileys on Vercel" and every result says the same thing: *run the WebSocket on a VPS
and call it from Vercel*. That is precisely what is ruled out here.

**But that advice assumes a persistent connection.** Nothing actually requires one. The way around
is to never hold a connection at all:

- **Stop using a browser.** whatsapp-web.js needs Chromium only because it screen-drives
  web.whatsapp.com. [Baileys](https://github.com/WhiskeySockets/Baileys) speaks the same WhatsApp
  multi-device protocol **directly over a WebSocket** — no browser, ~0.5 GB less RAM, and a bundle
  that fits in a function.
- **Stop holding the socket open.** Connect, do the work, disconnect — all inside a single
  invocation. The session lives in Postgres between invocations.

Vercel supports exactly this shape: a single-instance, session-scoped connection can run directly
in a Function with **Fluid compute** enabled, capped at 300s. Sending needs ~3–8s and pairing
needs about a minute, so both fit.

## 3. How it works

### Transport

`baileys@7.0.0-rc13`, pinned. `lib/whatsapp/index.ts` is the public surface
(`sendWhatsAppMessage`, `getWhatsAppState`, `logoutWhatsApp`) and delegates to a driver in
`lib/whatsapp/drivers/`. Callers never learn which driver is active.

Baileys addresses users as `<digits>@s.whatsapp.net` (`toWhatsAppJid`), **not** whatsapp-web.js's
`<digits>@c.us` (`toWhatsAppChatId`). The two are **not interchangeable** — sending to a `@c.us`
address over the multi-device protocol silently fails to deliver. `__tests__/lib/phone.test.ts`
pins this.

### Session storage

`lib/whatsapp/auth-state.ts` implements Baileys' `AuthenticationState` over Prisma:

| Table | Holds |
|---|---|
| `WhatsAppSession` | One row (`slug = "default"`). Credentials, status, linked phone, lease. |
| `WhatsAppSignalKey` | Signal key material — one row per key, cascades from the session. |

Both are encrypted at rest with AES-256-GCM (`lib/crypto/secret-box.ts`) under
`EMAIL_ENCRYPTION_KEY`. The credentials are full send-as-the-business access, so they are never
stored in the clear. **This is why a session now survives a redeploy** — the thing the old stack
could never do.

Keys are one row each rather than a single blob because a send touches only a handful; rewriting
the whole keyspace each time would be slow and a lost-update race.

Serialisation goes through Baileys' `BufferJSON` codec. Plain `JSON.stringify` would turn keys
into `{type:"Buffer",data:[…]}` and hand WhatsApp garbage.

### Pairing — one held-open request

`app/api/whatsapp/pair/route.ts`, SSE, `maxDuration = 300`, admin-only.

The socket that displays the QR must still be alive when it is scanned. Serverless keeps nothing
between requests, so pairing cannot be a poll. Instead **one invocation is held open** and the QR
is streamed out of it; the socket lives exactly as long as that response.

```
acquire lease -> makeWASocket -> stream QR frames over SSE (Baileys re-emits ~every 20s)
  -> admin scans -> creds.update -> persist
  -> connection close, statusCode 515 (restartRequired)   <-- EXPECTED, not a failure
  -> reconnect ONCE with the new credentials -> connection open
  -> persist status=ready + sessionPhone -> emit "linked" -> close -> release lease
```

**515 after a scan is normal.** WhatsApp always drops the socket immediately after a successful
pair and expects a fresh connection using the credentials it just issued. Treating it as an error
is the classic way to get a pairing loop.

The stream aborts on `request.signal` (admin closed the tab) and on a 280s wall-clock guard, so
the admin gets a real "expired, try again" rather than a truncated connection.

### Sending — connect, send, disconnect

`lib/whatsapp/drivers/baileys.ts`:

```
acquire lease (bounded wait) -> connect -> await connection:open
  -> sendMessage(jid, {text}) -> await server ack
  -> per PDF: sendMessage(jid, {document, mimetype, fileName, caption}) -> await ack
  -> sock.end() -> release lease (finally)
```

- **Sockets are deliberately never kept warm.** WhatsApp allows one live connection per linked
  device; two warm instances on the same credentials would kick each other off (`440
  connectionReplaced`) forever. This is a trap, not an optimisation opportunity.
- **Ack before close.** Destroying the socket the instant `sendMessage` resolves can drop the
  message — it has been handed over but not yet accepted. The ack wait is best-effort: a timeout
  means "unconfirmed", not "failed", so we never double-send.
- On `loggedOut` (401) the credentials are cleared and status set so the admin is told to re-pair,
  rather than notifications failing silently forever.

### The lease (`lib/whatsapp/lease.ts`)

A compare-and-swap on the session row, **not `pg_advisory_lock`**.

Advisory locks are scoped to a Postgres *session*. Neon pools through PgBouncer and Prisma's pool
hands out whichever connection is free, so a lock and its unlock can land on different backends —
the lock leaks or releases early. A conditional `updateMany` has neither problem and self-expires,
so a crashed invocation cannot deadlock sending forever.

The singleton row is seeded **in the migration**, because the CAS is an UPDATE and matches zero
rows if it doesn't exist.

### Drivers

Both environments **default to Baileys**, so local dev matches production. whatsapp-web.js
survives as `WHATSAPP_DRIVER=wwebjs` (`lib/whatsapp/drivers/wwebjs.ts`) for local debugging only —
it throws if `VERCEL=1`, because a confusing Puppeteer crash is worse than a clear refusal.

---

## 4. Verification status

**Be precise about this.** The parts below were exercised for real; the rest were not.

### Verified

| What | How |
|---|---|
| Baileys loads, WASM instantiates | Imports in ~830 ms; `initAuthCreds()` performs real curve keygen (32-byte noise key). |
| The Rust bridge is portable | `whatsapp-rust-bridge` inlines its WASM as **base64 inside a single 2 MB JS file** — no separate `.wasm` asset for Vercel's file tracing to lose, and no node-gyp. |
| `BufferJSON` round-trips Buffers byte-identically | Direct probe against the real library. |
| Disconnect codes match the design | `restartRequired=515`, `loggedOut=401`, `connectionReplaced=440`. |
| **A real QR is produced and streamed** | `GET /api/whatsapp/pair` locally emitted `connecting` then a live QR PNG — i.e. a real WebSocket to WhatsApp's servers, real handshake, no browser. |
| DB write path during pairing | Row moved to `status=qr` with `lastQrAt` set. |
| **The lease releases on stream teardown** | `lockOwner` returned to `null` after the stream ended. Had this leaked, sending would be blocked forever. |
| **The lease is safe under real concurrency** | 8 simultaneous acquirers raced against **real Neon**: exactly 1 won. Stale leases get taken over. |
| Status route no longer starts a session | `GET /api/whatsapp/status` returns `disconnected` without connecting. |
| Build, lint, types, tests | Production build passes; eslint clean at `--max-warnings=0`; `tsc` clean; 110 tests / 26 suites, green on 3 consecutive runs. |

### NOT verified — the post-scan path

**Nothing past the QR scan has been executed**, because it needs a physical phone to scan. Written
to spec and type-checked, but unproven:

1. **Credentials persisting after a scan** (`saveCreds` → `credsCipher` populated). The unit tests
   cover the storage logic with a stubbed codec; the real save has never run.
2. **The 515 `restartRequired` reconnect.** The single most likely place for a bug.
3. **A session actually reloading and sending** — the whole point of the feature.
4. **Media send.** Invoice + struk PDFs as Baileys `document` messages have never been sent.
5. **Ack-before-close timing** against a real server.
6. **Anything specific to Vercel's runtime**: the 300s Fluid cap, SSE not being buffered by a
   proxy, WASM under real file tracing, outbound WebSockets from a Function.

**A localhost green light proves very little here** — that exact trap already burned this project
once (see the 2026-07-06 prod-only 500s). Treat the first real scan on the deployed URL as a
go/no-go gate: it exercises the WASM load, the bundle, the 300s stream, and the Postgres store all
at once.

---

## 5. Known limitations and risks

### Baileys is unofficial and this version is a release candidate

Baileys is reverse-engineered. Using it **risks the business number being banned** — the same risk
whatsapp-web.js already carried, not a new one, but real. `7.0.0-rc13` is an RC.

The `legacy` 6.7.x line was rejected deliberately: it pulls `libsignal` *and* an eslint config from
**GitHub as runtime dependencies**, which is fragile on Vercel installs, and it predates the WASM
bridge. If 7.x proves unstable, 6.7.23 is the fallback — at that cost.

### Outbound only

Nothing in the app reads inbound WhatsApp messages, so connect-per-send loses nothing today. **If
inbound messages are ever needed, this architecture cannot provide them** — receiving requires a
persistent connection, which is exactly what serverless forbids. That would force the VPS this
design exists to avoid.

### Latency

~3–8s per message (connection handshake per send). Fine for notifications; acceptable for OTP
(comparable to SMS). It will not do for anything interactive.

### Sends are serialised

The lease means one message at a time. At Mektek's volume (a few notifications a day) this is
free. A burst would queue, and a send that waits >25s for the lease fails with "WhatsApp is busy".
This is a deliberate correctness-over-throughput trade: the alternative is sockets kicking each
other off.

### Pairing and sending contend

While an admin holds the pairing stream (up to 300s), sends will fail with "busy" — and vice
versa. Pairing is rare and admin-initiated, so this is accepted rather than solved.

### Test coverage gap: Baileys is stubbed

`__tests__/lib/whatsapp-auth-state.test.ts` stubs Baileys. It is ESM-only (`"type": "module"`, no
CJS build) and the suite runs under ts-jest in CommonJS; pulling it in would mean transforming it
and its 2 MB WASM bridge on every run. The stub preserves BufferJSON's contract (Buffers survive a
JSON round-trip), so what is tested is **our** storage/encryption/guard logic — not the real
codec's compatibility. That the real codec honours the contract was confirmed by direct probe and
by the live pairing flow, not by this suite.

### Template editing is still a stub

The "Simpan Template (Backend Pending)" button on the WhatsApp page remains disabled and unwired.
The real templates live in `actions/mektek/whatsapp-notifications.ts`. Unchanged by this work.

### Losing the encryption key loses the session

`EMAIL_ENCRYPTION_KEY` is not rotatable without re-pairing. On a wrong/rotated key the auth store
**throws rather than silently re-pairing** — deliberately, so a session a correct key could still
read is never destroyed. Restore the old value or log out and re-pair.

---

## 6. Prerequisites on Vercel

Both are required; the design does not work without them.

1. **Enable Fluid compute** (Settings → Functions). It is what allows the 300s pairing window, on
   Hobby too. Without it, pairing cannot work.
2. **Set `EMAIL_ENCRYPTION_KEY`** — 64 hex chars, `openssl rand -hex 32`. It is listed in
   `.env.example` but **empty in `.env.production.example` and no code read it before this
   change**, so it is very likely unset. Pairing fails closed without it. Redeploy after adding.

Then run `pnpm prisma migrate deploy` against every environment (incl. Neon) for the
`WhatsAppSession` / `WhatsAppSignalKey` tables.

## 7. Pairing in production

1. Sign in as an admin, open `/{locale}/mektek/whatsapp`.
2. Click **Hubungkan WhatsApp**. The QR is only fetched on demand — it no longer appears by
   itself, because showing one means holding a live socket open.
3. On the phone: WhatsApp → **Perangkat Tertaut** → **Tautkan Perangkat** → scan.
4. Leave the page open until it flips to **Terhubung**. Closing it aborts the attempt.
5. Confirm `WhatsAppSession.credsCipher` is populated.
6. Redeploy and confirm the session **survives** with no re-scan.

## 8. Troubleshooting

| Symptom | Meaning |
|---|---|
| "EMAIL_ENCRYPTION_KEY is not configured" | Prerequisite 2. Fails closed by design. |
| Stream dies at ~5 min | Fluid compute likely off, or the scan simply took too long. Retry. |
| "WhatsApp is busy…" | Lease contention — a send or another pairing is in flight. Retry shortly. |
| Pairing loops, never links | Suspect the 515 reconnect. Set `WHATSAPP_LOG_LEVEL=debug` to unsilence Baileys. |
| Session vanishes after pairing | A credential write did not land. `lib/prisma.ts` returns a **mock client** with no `DATABASE_URL` that silently resolves writes to `null`; the auth store throws loudly on this, so check for that error. |
| Sends fail after working for a while | Device unlinked from the phone → 401 → credentials cleared. Re-pair. |
| "Stored WhatsApp credentials could not be decrypted" | `EMAIL_ENCRYPTION_KEY` changed. Restore it, or log out and re-pair. |
| Puppeteer/Chromium error on Vercel | Something set `WHATSAPP_DRIVER=wwebjs` in a deployed env. Unset it. |

`WHATSAPP_LOG_LEVEL` (default `silent`) controls Baileys' pino logger. It logs at `info` by
default, which would flood function logs with protocol chatter on every send.

## 9. Rolling back

`WHATSAPP_DRIVER=wwebjs` restores the old transport **locally only** — it cannot run on Vercel, so
it is not a production rollback. A real rollback means reverting the commit; the
`WhatsAppSession` / `WhatsAppSignalKey` tables are additive and harmless if left behind.

## 10. Reference

- Architecture summary: `CLAUDE.md` → WhatsApp Integration
- Operator steps (Indonesian): `docs/panduan-operasional-dan-testing-mektek.md` §5.14
- Code: `lib/whatsapp/`, `lib/crypto/secret-box.ts`, `app/api/whatsapp/`
- Tests: `__tests__/lib/{phone,secret-box,whatsapp-lease,whatsapp-auth-state}.test.ts`
