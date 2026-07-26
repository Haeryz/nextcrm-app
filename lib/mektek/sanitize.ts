import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { boundedText, MAX_ADDRESS_LEN, MAX_NAME_LEN } from "@/lib/mektek/text";

// Shared bounds + validation for customer-supplied Mektek fields. Centralized so
// the storefront (public), admin, and registration paths all cap the same way
// before values are persisted into the `tags` JSON blob and later rendered into
// generated PDFs and WhatsApp message bodies.
//
// The bounds and `boundedText` themselves live in `./text`, which imports nothing
// — this module adds the phone validation on top. Re-exported here so existing
// server-side callers keep working unchanged; anything reachable from a client
// component should import from `./text` directly to stay off libphonenumber-js.
export {
  boundedText,
  MAX_NAME_LEN,
  MAX_ADDRESS_LEN,
  MAX_VEHICLE_LEN,
  MAX_VEHICLE_PLATE_NUMBER_LEN,
  MAX_VEHICLE_FLEET_NUMBER_LEN,
  MAX_COMPLAINT_LEN,
} from "@/lib/mektek/text";

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
