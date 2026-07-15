import "server-only";

import crypto from "crypto";

import { prismadb } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export type AuthRateLimitResult = {
  ok: boolean;
  retryAfterMs: number;
};

const hashKey = (key: string) =>
  crypto.createHash("sha256").update(key).digest("hex");

export async function consumeAuthRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<AuthRateLimitResult> {
  const keyHash = hashKey(key);
  const now = new Date();

  try {
    const current = await prismadb.authRateLimit.findUnique({
      where: { keyHash },
    });

    if (current?.blockedUntil && current.blockedUntil.getTime() > now.getTime()) {
      return {
        ok: false,
        retryAfterMs: current.blockedUntil.getTime() - now.getTime(),
      };
    }

    if (
      !current ||
      current.windowStartedAt.getTime() + windowMs <= now.getTime()
    ) {
      await prismadb.authRateLimit.upsert({
        where: { keyHash },
        create: {
          keyHash,
          attempts: 1,
          windowStartedAt: now,
          blockedUntil: null,
        },
        update: {
          attempts: 1,
          windowStartedAt: now,
          blockedUntil: null,
        },
      });
      return { ok: true, retryAfterMs: 0 };
    }

    if (current.attempts >= limit) {
      const blockedUntil = new Date(
        Math.max(
          current.windowStartedAt.getTime() + windowMs,
          now.getTime() + 60_000,
        ),
      );
      await prismadb.authRateLimit.update({
        where: { keyHash },
        data: { blockedUntil },
      });
      return {
        ok: false,
        retryAfterMs: blockedUntil.getTime() - now.getTime(),
      };
    }

    await prismadb.authRateLimit.update({
      where: { keyHash },
      data: { attempts: { increment: 1 } },
    });
    return { ok: true, retryAfterMs: 0 };
  } catch (error) {
    // A database outage must not remove all brute-force protection. This fallback
    // remains per-instance, while healthy production traffic uses shared DB state.
    console.error("[AUTH_RATE_LIMIT_FALLBACK]", error);
    const fallback = checkRateLimit(
      `auth-fallback:${keyHash}`,
      limit,
      windowMs,
    );
    return { ok: fallback.ok, retryAfterMs: fallback.retryAfterMs };
  }
}
