import "server-only";
import crypto from "crypto";
import { prismadb } from "@/lib/prisma";

// Shared WhatsApp-OTP core. This is deliberately NOT a "use server" module: in a
// "use server" file every export becomes a network-invocable action, and
// verifyOtpCode must only ever be reachable from trusted server code (registration
// and the phone-claim flow), never directly from the browser.

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export const hashOtpCode = (code: string): string =>
  crypto.createHash("sha256").update(code).digest("hex");

// Constant-time compare of two hex digests. SHA-256-hashing both sides to a
// fixed-length digest keeps the compare constant-time and avoids timingSafeEqual
// throwing on differing input lengths (same pattern as the service-order token check
// and the Midtrans webhook signature check).
const constantTimeEqual = (a: string, b: string): boolean => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// Generates a fresh 6-digit code and persists only its hash. One live row per phone
// (upsert), 5-minute TTL, attempts reset. Returns the plaintext code so the caller
// can deliver it (over WhatsApp); the plaintext is never stored.
export async function issueOtpCode(phoneNormalized: string): Promise<string> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prismadb.customerPhoneVerification.upsert({
    where: { phoneNormalized },
    update: { codeHash, expiresAt, attempts: 0, consumedAt: null },
    create: { phoneNormalized, codeHash, expiresAt },
  });

  return code;
}

// Verifies a submitted code against the stored hash. Enforces expiry, single-use
// (consumedAt), and an attempt ceiling. Increments attempts on every wrong guess;
// marks the row consumed on success. Never throws on bad input.
export async function verifyOtpCode(
  phoneNormalized: string,
  code: string
): Promise<boolean> {
  const normalized = String(phoneNormalized ?? "").trim();
  const submitted = String(code ?? "").trim();
  if (!normalized || !submitted) return false;

  const record = await prismadb.customerPhoneVerification.findUnique({
    where: { phoneNormalized: normalized },
  });

  if (!record) return false;
  if (record.consumedAt) return false;
  if (record.expiresAt.getTime() < Date.now()) return false;
  if (record.attempts >= OTP_MAX_ATTEMPTS) return false;

  if (!constantTimeEqual(record.codeHash, hashOtpCode(submitted))) {
    await prismadb.customerPhoneVerification.update({
      where: { phoneNormalized: normalized },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  await prismadb.customerPhoneVerification.update({
    where: { phoneNormalized: normalized },
    data: { consumedAt: new Date() },
  });
  return true;
}
