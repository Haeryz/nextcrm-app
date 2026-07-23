export const MAX_FINANCE_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const FINANCE_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  signature.every((value, index) => bytes[index] === value);

export function validateFinanceAttachment(
  mimeType: string,
  bytes: Uint8Array,
) {
  if (bytes.byteLength === 0) return { error: "File kosong" } as const;
  if (bytes.byteLength > MAX_FINANCE_ATTACHMENT_BYTES) {
    return { error: "Ukuran file maksimal 5 MB" } as const;
  }
  const valid =
    (mimeType === "application/pdf" && startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) ||
    (mimeType === "image/jpeg" && startsWith(bytes, [0xff, 0xd8, 0xff])) ||
    (mimeType === "image/png" && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) ||
    (mimeType === "image/webp" &&
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]));
  return valid ? ({ data: true } as const) : ({ error: "Format file tidak valid" } as const);
}
