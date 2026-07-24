import "server-only";
import crypto from "crypto";
import { prismadb } from "@/lib/prisma";

// Shared email-OTP core. This is deliberately NOT a "use server" module: in a
// "use server" file every export becomes a network-invocable action, and
// verifyEmailOtpCode must only ever be reachable from trusted server code
// (registration and the email-claim flow), never directly from the browser —
// otherwise an attacker could brute-force codes over the network.

export const EMAIL_OTP_TTL_MS = 5 * 60 * 1000;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;

export const hashEmailOtpCode = (code: string): string =>
  crypto.createHash("sha256").update(code).digest("hex");

// Constant-time compare of two hex digests. SHA-256-hashing both sides to a
// fixed-length digest keeps the compare constant-time and avoids timingSafeEqual
// throwing on differing input lengths (same pattern as lib/otp.ts and the
// Midtrans webhook signature check).
const constantTimeEqual = (a: string, b: string): boolean => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// Generates a fresh 6-digit code and persists only its hash. One live row per
// email (upsert), 5-minute TTL, attempts reset. Returns the plaintext code so
// the caller can deliver it (over email); the plaintext is never stored.
export async function issueEmailOtpCode(
  emailNormalized: string
): Promise<string> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = hashEmailOtpCode(code);
  const expiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);

  await prismadb.customerEmailVerification.upsert({
    where: { emailNormalized },
    update: { codeHash, expiresAt, attempts: 0, consumedAt: null },
    create: { emailNormalized, codeHash, expiresAt },
  });

  return code;
}

// Verifies a submitted code against the stored hash. Enforces:
//   - row must exist
//   - not already consumed
//   - not expired
//   - attempts < EMAIL_OTP_MAX_ATTEMPTS (locked out beyond cap)
//   - constant-time compare against the stored hash
// On a wrong guess, attempts is incremented; on the cap being reached the row
// is locked even if a correct code arrives later. On a match the row is marked
// consumed so the same code cannot be replayed.
export async function verifyEmailOtpCode(
  emailNormalized: string,
  code: string
): Promise<boolean> {
  const record = await prismadb.customerEmailVerification.findUnique({
    where: { emailNormalized },
  });
  if (!record) return false;

  const now = Date.now();
  if (record.consumedAt) return false;
  if (record.expiresAt.getTime() <= now) return false;
  if (record.attempts >= EMAIL_OTP_MAX_ATTEMPTS) return false;

  if (!constantTimeEqual(hashEmailOtpCode(code), record.codeHash)) {
    await prismadb.customerEmailVerification.update({
      where: { emailNormalized },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  await prismadb.customerEmailVerification.update({
    where: { emailNormalized },
    data: { consumedAt: new Date(now) },
  });

  return true;
}
