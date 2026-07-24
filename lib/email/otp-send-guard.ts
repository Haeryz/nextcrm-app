import "server-only";

import crypto from "crypto";
import { prismadb } from "@/lib/prisma";

type GuardResult = { ok: boolean; retryAfterMs: number };

const DEFAULT_MIN_INTERVAL_MS = 8_000;
const DEFAULT_HOURLY_LIMIT = 60;
const HOUR_MS = 60 * 60 * 1000;
const DATABASE_FAILURE_RETRY_MS = 60_000;
const MAX_CAS_ATTEMPTS = 16;

function integerSetting(name: string, fallback: number, min: number, max: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * A cross-instance fixed-window reservation using compare-and-swap updates.
 * Unlike the general authentication limiter, concurrent callers cannot all read
 * the same counter and then all pass: only one update can match each counter
 * value. Mirrors lib/whatsapp/otp-send-guard.ts verbatim — see that file for
 * the rationale.
 */
async function reserveBucket(
  key: string,
  limit: number,
  windowMs: number,
): Promise<GuardResult> {
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

  // Extreme contention is itself a burst. Reject instead of risking the sender.
  return { ok: false, retryAfterMs: DATABASE_FAILURE_RETRY_MS };
}

/**
 * Reserves sender-wide email OTP capacity before an OTP is generated or sent.
 * The short bucket spaces messages out; the hourly bucket limits sustained
 * volume so the sending domain's reputation is not damaged by a flood.
 */
export async function reserveEmailOtpSend(): Promise<GuardResult> {
  const minIntervalMs = integerSetting(
    "EMAIL_OTP_MIN_INTERVAL_MS",
    DEFAULT_MIN_INTERVAL_MS,
    1_000,
    5 * 60_000,
  );
  const hourlyLimit = integerSetting(
    "EMAIL_OTP_HOURLY_LIMIT",
    DEFAULT_HOURLY_LIMIT,
    1,
    2_000,
  );

  try {
    const spacing = await reserveBucket(
      "email-otp:sender:spacing",
      1,
      minIntervalMs,
    );
    if (!spacing.ok) return spacing;

    return await reserveBucket(
      "email-otp:sender:hourly",
      hourlyLimit,
      HOUR_MS,
    );
  } catch (error) {
    console.error("[EMAIL_OTP_SEND_GUARD]", error);
    // Fail closed: protect the sending domain reputation on DB outages.
    return { ok: false, retryAfterMs: DATABASE_FAILURE_RETRY_MS };
  }
}
