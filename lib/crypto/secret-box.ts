import "server-only";
import crypto from "crypto";

// Symmetric encryption for secrets we must be able to read back — currently the
// paired WhatsApp credentials. Deliberately NOT a "use server" module: every export
// in such a file becomes network-invocable, and a browser-reachable decrypt oracle
// would defeat the point.
//
// Note this is the repo's first *reversible* crypto. Everything else (lib/otp.ts,
// lib/customer-session.ts, the Midtrans signature check) is one-way hashing, which
// is the right default — reach for this only when the plaintext is genuinely needed
// later, as it is for a session we must replay to WhatsApp on every send.

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const TAG_BYTES = 16;
const VERSION = "v1";

let cachedKey: Buffer | null = null;

/**
 * Thrown when the key is missing or malformed. Callers surface this as
 * "WhatsApp is not configured" rather than letting it read as a transient fault —
 * it is a deployment problem and retrying will never fix it.
 */
export class SecretKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretKeyError";
  }
}

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.EMAIL_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new SecretKeyError(
      "EMAIL_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` and add it to the environment."
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new SecretKeyError(
      "EMAIL_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate one with `openssl rand -hex 32`."
    );
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_BYTES) {
    throw new SecretKeyError("EMAIL_ENCRYPTION_KEY must decode to 32 bytes.");
  }

  cachedKey = key;
  return key;
}

/** True when a usable key is configured. Lets callers fail closed with a clear message. */
export function isSecretBoxConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypts a UTF-8 string. Output is `v1.<iv>.<tag>.<ciphertext>`, all base64url.
 * The version prefix exists so the key/scheme can be rotated later without having
 * to guess how existing rows were written.
 */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Reverses `encryptSecret`. Throws if the payload is malformed or fails the GCM
 * auth tag — which also means a tampered or wrong-key row throws rather than
 * silently returning garbage.
 */
export function decryptSecret(payload: string): string {
  const parts = String(payload || "").split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new SecretKeyError("Malformed encrypted payload.");
  }

  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const ciphertext = Buffer.from(parts[3], "base64url");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new SecretKeyError("Malformed encrypted payload.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Test seam — the key is cached per process, so tests that swap the env must reset it. */
export function __resetSecretBoxKeyCacheForTests(): void {
  cachedKey = null;
}
