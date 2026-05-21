export function normalizePhoneNumber(phone: string): string {
  const trimmed = String(phone || "").trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export function phoneDigits(normalizedPhone: string): string {
  return String(normalizedPhone || "").replace(/\D/g, "");
}

export function buildPhoneAccountEmail(normalizedPhone: string): string {
  const digits = phoneDigits(normalizedPhone);
  return `${digits}@phone.nextcrm.local`;
}
