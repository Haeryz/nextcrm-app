import "server-only";

import crypto from "crypto";
import { z } from "zod";

// Email validation + normalization. Stronger than the ad-hoc regex used elsewhere
// in the app (e.g. actions/auth/bootstrap-admin.ts) because zod's email check
// follows RFC 5322 more closely. Disposable/temp domains are rejected separately
// by lib/email/disposable-domains.ts.

const emailSchema = z.string().trim().toLowerCase().email();

export function normalizeEmail(raw: string): string | null {
  const parsed = emailSchema.safeParse(String(raw ?? ""));
  return parsed.success ? parsed.data : null;
}

export function isValidEmail(raw: string): boolean {
  return normalizeEmail(raw) !== null;
}

// sha256 of the normalized email. Used for EmailLog.recipientHash and for
// rate-limit keys so PII does not sit in the AuthRateLimit table.
export function emailRecipientHash(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase())
    .digest("hex");
}

export function extractDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const at = normalized.lastIndexOf("@");
  if (at < 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

// Optional MX-record validation. Off by default (EMAIL_MX_VALIDATION != "true")
// because it adds DNS latency and a failure surface; enable if the disposable
// blocklist alone proves insufficient.
import { promises as dnsPromises } from "dns";

const mxCache = new Map<string, { ok: boolean; expiresAt: number }>();
const MX_CACHE_TTL_MS = 10 * 60 * 1000;

export async function lookupMx(domain: string): Promise<boolean> {
  if (process.env.EMAIL_MX_VALIDATION !== "true") return true;
  const key = domain.toLowerCase();
  const now = Date.now();
  const cached = mxCache.get(key);
  if (cached && cached.expiresAt > now) return cached.ok;
  try {
    const records = await dnsPromises.resolveMx(key);
    const ok = records.length > 0;
    mxCache.set(key, { ok, expiresAt: now + MX_CACHE_TTL_MS });
    return ok;
  } catch {
    mxCache.set(key, { ok: false, expiresAt: now + MX_CACHE_TTL_MS });
    return false;
  }
}
