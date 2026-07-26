import "server-only";

import crypto from "crypto";
import {
  integerSetting,
  RATE_BUCKET_DB_FAILURE_RETRY_MS,
  reserveRateBucket,
} from "@/lib/whatsapp/rate-bucket";

// Spacing between consecutive outbound messages, sender-wide.
//
// This is NOT the lease (lib/whatsapp/lease.ts). The lease is a mutex over the one
// live socket and releases in a `finally` the instant a send finishes, so back-to-back
// sends serialise but happen milliseconds apart — which is precisely the machine-gun
// pattern that gets a number flagged. The lease stays untouched; this runs *before*
// it, so the wait is spent outside the mutex and does not block pairing or logout.
//
// Jitter matters as much as the interval: a message every N milliseconds on the dot
// is a stronger automation signal than the volume itself.

const DEFAULT_MIN_INTERVAL_MS = 8_000;
const DEFAULT_JITTER_MS = 4_000;
const DEFAULT_MAX_WAIT_MS = 20_000;

const MAX_WAIT_ATTEMPTS = 4;

export type WhatsAppSendSlot = { ok: boolean; retryAfterMs: number };

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

/** Uniform jitter in [0, spread). Uses the CSPRNG only because it is already imported. */
function jitter(spread: number): number {
  if (spread <= 0) return 0;
  return crypto.randomInt(0, Math.max(1, Math.floor(spread)));
}

function settings() {
  const minIntervalMs = integerSetting(
    "WHATSAPP_SEND_MIN_INTERVAL_MS",
    DEFAULT_MIN_INTERVAL_MS,
    500,
    5 * 60_000,
  );
  const jitterMs = integerSetting(
    "WHATSAPP_SEND_JITTER_MS",
    DEFAULT_JITTER_MS,
    0,
    60_000,
  );
  const maxWaitMs = integerSetting(
    "WHATSAPP_SEND_MAX_WAIT_MS",
    DEFAULT_MAX_WAIT_MS,
    0,
    60_000,
  );
  return { minIntervalMs, jitterMs, maxWaitMs };
}

/**
 * Reserves the next send slot, waiting out the spacing window when the wait is
 * short enough to sit inside one invocation. Returns `ok: false` when the caller
 * would have to wait longer than `WHATSAPP_SEND_MAX_WAIT_MS`, so a burst is dropped
 * (and logged as suppressed) rather than queued into a serverless timeout.
 *
 * On success the caller has already absorbed a randomized delay, so consecutive
 * messages are never evenly spaced.
 */
export async function reserveWhatsAppSendSlot(): Promise<WhatsAppSendSlot> {
  const { minIntervalMs, jitterMs, maxWaitMs } = settings();
  const deadline = Date.now() + maxWaitMs;

  try {
    for (let attempt = 0; attempt < MAX_WAIT_ATTEMPTS; attempt += 1) {
      const spacing = await reserveRateBucket(
        "whatsapp:sender:spacing",
        1,
        minIntervalMs,
      );

      if (spacing.ok) {
        // Held outside the lease on purpose: this delay is about how the traffic
        // looks from WhatsApp's side, not about socket contention.
        await sleep(jitter(jitterMs));
        return { ok: true, retryAfterMs: 0 };
      }

      const wait = spacing.retryAfterMs + jitter(jitterMs);
      if (Date.now() + wait > deadline) return spacing;
      await sleep(wait);
    }

    return { ok: false, retryAfterMs: minIntervalMs };
  } catch (error) {
    console.error("[WHATSAPP_SEND_THROTTLE]", error);
    // The throttle protects the account itself, so a DB outage fails closed.
    return { ok: false, retryAfterMs: RATE_BUCKET_DB_FAILURE_RETRY_MS };
  }
}
