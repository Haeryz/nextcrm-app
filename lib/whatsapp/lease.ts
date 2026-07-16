import "server-only";
import crypto from "crypto";
import { prismadb } from "@/lib/prisma";

// A mutex over the single WhatsApp connection, held in Postgres.
//
// Why this exists: WhatsApp allows one live socket per linked device. If two
// serverless invocations connect with the same credentials, the server kicks one
// off (440 connectionReplaced) and both can end up writing conflicting Signal key
// state. Sends are rare and bursty here (order created, order completed, OTP), so
// serialising them costs nothing and removes the whole failure class.
//
// Why not pg_advisory_lock: it is scoped to a Postgres *session*. Neon pools through
// PgBouncer, and Prisma's pool hands out whichever connection is free, so the lock
// and the unlock can land on different backends — the lock would leak or release
// early. A row-level compare-and-swap has neither problem, and self-expires if the
// holder dies mid-invocation (which serverless does routinely).

export const WHATSAPP_SESSION_SLUG = "default";

const DEFAULT_TTL_MS = 60_000;
const ACQUIRE_RETRY_MS = 400;

export type WhatsAppLease = {
  owner: string;
  /** Extends the lease; call periodically during long holds (pairing). */
  heartbeat: (ttlMs?: number) => Promise<boolean>;
  release: () => Promise<void>;
};

/**
 * Tries once to take the lease. Returns null if another invocation holds a
 * lease that has not yet expired.
 */
async function tryAcquire(ttlMs: number): Promise<WhatsAppLease | null> {
  const owner = crypto.randomUUID();
  const now = new Date();

  // Atomic compare-and-swap: Postgres serialises concurrent UPDATEs on the same
  // row, so of N racing invocations exactly one sees count === 1. The OR clause is
  // what lets a stale lease (crashed holder) be taken over rather than deadlocking.
  const { count } = await prismadb.whatsAppSession.updateMany({
    where: {
      slug: WHATSAPP_SESSION_SLUG,
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    data: { lockOwner: owner, lockedUntil: new Date(now.getTime() + ttlMs) },
  });

  if (count === 0) return null;

  return {
    owner,
    heartbeat: async (extendMs = ttlMs) => {
      // Guarded by lockOwner: if our lease already expired and someone else took
      // over, we must not stomp their lease — we report false and the caller aborts.
      const res = await prismadb.whatsAppSession.updateMany({
        where: { slug: WHATSAPP_SESSION_SLUG, lockOwner: owner },
        data: { lockedUntil: new Date(Date.now() + extendMs) },
      });
      return res.count > 0;
    },
    release: async () => {
      await prismadb.whatsAppSession.updateMany({
        where: { slug: WHATSAPP_SESSION_SLUG, lockOwner: owner },
        data: { lockOwner: null, lockedUntil: null },
      });
    },
  };
}

/**
 * Acquires the connection lease, retrying until `waitMs` elapses.
 *
 * Returns null rather than throwing when the lease stays busy: the caller decides
 * whether that is an error (a send) or something to report to the operator (a
 * pairing attempt while a send is in flight).
 */
export async function acquireWhatsAppLease(options?: {
  ttlMs?: number;
  waitMs?: number;
}): Promise<WhatsAppLease | null> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const waitMs = options?.waitMs ?? 0;
  const deadline = Date.now() + waitMs;

  for (;;) {
    const lease = await tryAcquire(ttlMs);
    if (lease) return lease;
    if (Date.now() + ACQUIRE_RETRY_MS > deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, ACQUIRE_RETRY_MS));
  }
}

/**
 * Outcome of a leased operation. Discriminated rather than returning `T | busy`
 * so callers can't forget to handle contention, and so `T` may be void.
 */
export type LeaseOutcome<T> =
  | { leaseBusy: true }
  | { leaseBusy: false; value: T };

/** Runs `fn` while holding the lease, always releasing it. */
export async function withWhatsAppLease<T>(
  options: { ttlMs?: number; waitMs?: number },
  fn: (lease: WhatsAppLease) => Promise<T>
): Promise<LeaseOutcome<T>> {
  const lease = await acquireWhatsAppLease(options);
  if (!lease) return { leaseBusy: true };

  try {
    return { leaseBusy: false, value: await fn(lease) };
  } finally {
    // Best-effort: if the release fails the lease still expires on its own, which
    // is exactly why it has a TTL.
    await lease.release().catch(() => {});
  }
}
