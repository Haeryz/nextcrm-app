import { parsePhoneNumberFromString } from "libphonenumber-js";

// Every phone number in the app is stored/queried through this module so the
// dedupe key (`phoneNormalized`), customer search, and the WhatsApp chat id all
// agree. Indonesia is the default region: local `0…`, `62…`, and `+62…` inputs
// all collapse to a single canonical E.164 value (`+62…`).
const DEFAULT_REGION = "ID" as const;

/**
 * Canonical phone normalizer. Returns E.164 (e.g. `+6281234567890`) when the
 * input can be parsed for the default region; otherwise falls back to a
 * best-effort `+<digits>` form (leading Indonesian `0` → `+62`) so callers still
 * get a stable identifier and never lose the number. Returns `""` for empty input.
 */
export function normalizePhoneNumber(phone: string): string {
  const trimmed = String(phone || "").trim();
  if (!trimmed) return "";

  const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_REGION);
  if (parsed && parsed.isValid()) {
    return parsed.number; // already E.164
  }

  // Fallback: canonicalize as best we can without a valid parse.
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (!hasPlus && digits.startsWith("0")) {
    // Indonesian local trunk prefix → country code.
    return `+62${digits.slice(1)}`;
  }
  return `+${digits}`;
}

/**
 * True when the input is a plausible phone number for the default region.
 * Uses possible-length validation (lenient) so we reject obvious junk without
 * rejecting valid-but-unusual numbers.
 */
export function isValidPhoneNumber(phone: string): boolean {
  const trimmed = String(phone || "").trim();
  if (!trimmed) return false;
  const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_REGION);
  return !!parsed && parsed.isPossible();
}

export function phoneDigits(normalizedPhone: string): string {
  return String(normalizedPhone || "").replace(/\D/g, "");
}

/**
 * WhatsApp chat id derived from the same canonical E.164 value the rest of the
 * app stores, so the number we message always matches the number we saved.
 */
export function toWhatsAppChatId(phone: string): string | null {
  const digits = phoneDigits(normalizePhoneNumber(phone));
  if (!digits) return null;
  return `${digits}@c.us`;
}

export function buildPhoneAccountEmail(normalizedPhone: string): string {
  const digits = phoneDigits(normalizedPhone);
  return `${digits}@phone.nextcrm.local`;
}
