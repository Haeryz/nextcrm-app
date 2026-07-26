import "server-only";

import crypto from "crypto";
import { prismadb } from "@/lib/prisma";

// Cross-instance fixed-window reservation, extracted from otp-send-guard.ts so the
// OTP guard and the general send throttle share one implementation.
//
// Why the database and not an in-memory timer: serverless instances share no
// memory, so a module-level `lastSentAt` would let N concurrent instances all send
// at once. Rows in `AuthRateLimit` are the only thing every instance can see.
//
// Why compare-and-swap and not read-then-write: concurrent callers would otherwise
// all read the same counter and all pass. Only one UPDATE can match a given
// (attempts, windowStartedAt) pair, so exactly one caller wins each slot.

export type RateBucketResult = { ok: boolean; retryAfterMs: number };

/** Cool-off handed back when the shared counter itself is unreachable. */
export const RATE_BUCKET_DB_FAILURE_RETRY_MS = 60_000;

const MAX_CAS_ATTEMPTS = 16;

/** Reads a clamped integer env override, falling back when unset or unparseable. */
export function integerSetting(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Reserves one slot of `limit` within a `windowMs` window keyed by `key`.
 * Returns `{ ok: false, retryAfterMs }` when the window is full.
 */
export async function reserveRateBucket(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateBucketResult> {
  const keyHash = hashKey(key);

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const now = new Date();
    let current = await prismadb.authRateLimit.findUnique({ where: { keyHash } });

    if (!current) {
      current = await prismadb.authRateLimit.upsert({
        where: { keyHash },
        create: {
          keyHash,
          attempts: 0,
          windowStartedAt: now,
          blockedUntil: null,
        },
        update: {},
      });
    }

    if (current.blockedUntil && current.blockedUntil.getTime() > now.getTime()) {
      return {
        ok: false,
        retryAfterMs: current.blockedUntil.getTime() - now.getTime(),
      };
    }

    const expired =
      current.windowStartedAt.getTime() + windowMs <= now.getTime();

    if (expired) {
      const reset = await prismadb.authRateLimit.updateMany({
        where: {
          keyHash,
          attempts: current.attempts,
          windowStartedAt: current.windowStartedAt,
        },
        data: {
          attempts: 1,
          windowStartedAt: now,
          blockedUntil: null,
        },
      });
      if (reset.count === 1) return { ok: true, retryAfterMs: 0 };
      continue;
    }

    if (current.attempts >= limit) {
      const blockedUntil = new Date(
        current.windowStartedAt.getTime() + windowMs,
      );
      const blocked = await prismadb.authRateLimit.updateMany({
        where: {
          keyHash,
          attempts: current.attempts,
          windowStartedAt: current.windowStartedAt,
        },
        data: { blockedUntil },
      });
      if (blocked.count === 1) {
        return {
          ok: false,
          retryAfterMs: Math.max(1, blockedUntil.getTime() - now.getTime()),
        };
      }
      continue;
    }

    const reserved = await prismadb.authRateLimit.updateMany({
      where: {
        keyHash,
        attempts: current.attempts,
        windowStartedAt: current.windowStartedAt,
      },
      data: { attempts: { increment: 1 }, blockedUntil: null },
    });
    if (reserved.count === 1) return { ok: true, retryAfterMs: 0 };
  }

  // Extreme contention is itself a burst. Reject instead of risking the account.
  return { ok: false, retryAfterMs: RATE_BUCKET_DB_FAILURE_RETRY_MS };
}
