import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";

// Shared bounds + validation for customer-supplied Mektek fields. Centralized so
// the storefront (public), admin, and registration paths all cap the same way
// before values are persisted into the `tags` JSON blob and later rendered into
// generated PDFs and WhatsApp message bodies.
export const MAX_NAME_LEN = 120;
export const MAX_ADDRESS_LEN = 500;
export const MAX_VEHICLE_LEN = 120;
export const MAX_COMPLAINT_LEN = 2000;

/** Collapse whitespace, trim, and hard-cap length. */
export function boundedText(value: unknown, maxLen: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Validate + bound a name/phone/address triple in one place. Returns either an
 * `error` message or the sanitized `data`. Phone is required and normalized to
 * canonical E.164; name is required and capped; address is optional and capped.
 */
export function sanitizeMektekCustomer(input: {
  customerName?: unknown;
  phone?: unknown;
  address?: unknown;
}):
  | { error: string }
  | {
      data: {
        customerName: string;
        phone: string;
        phoneNormalized: string;
        address: string;
      };
    } {
  const customerName = boundedText(input.customerName, MAX_NAME_LEN);
  if (!customerName) return { error: "Nama wajib diisi" };

  const phone = String(input.phone ?? "").trim();
  if (!isValidPhoneNumber(phone)) return { error: "Nomor telepon tidak valid" };

  const address = boundedText(input.address, MAX_ADDRESS_LEN);

  return {
    data: {
      customerName,
      phone,
      phoneNormalized: normalizePhoneNumber(phone),
      address,
    },
  };
}
