export const MAX_LOGISTICS_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const SUPPORTED_DOCUMENT_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function hasExpectedSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === "image/jpeg") {
    return startsWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (contentType === "image/png") {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (contentType === "image/webp") {
    return (
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
    );
  }
  if (contentType === "application/pdf") {
    return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  }
  return false;
}

export function validateLogisticsReceiptImageUpload(
  contentType: string | null,
  bytes: Uint8Array,
): { contentType: string } | { error: string } {
  const normalizedType = String(contentType ?? "").toLowerCase().split(";")[0].trim();

  if (!SUPPORTED_CONTENT_TYPES.has(normalizedType)) {
    return { error: "Pilih foto kondisi barang berformat JPEG, PNG, atau WebP" };
  }
  if (bytes.byteLength === 0) {
    return { error: "Pilih file foto kondisi barang yang tidak kosong" };
  }
  if (bytes.byteLength > MAX_LOGISTICS_RECEIPT_IMAGE_BYTES) {
    return { error: "Ukuran foto kondisi barang maksimal 5 MB" };
  }
  if (!hasExpectedSignature(normalizedType, bytes)) {
    return { error: "File yang dipilih bukan gambar yang valid" };
  }

  return { contentType: normalizedType };
}

export function validateLogisticsDocumentUpload(
  contentType: string | null,
  bytes: Uint8Array,
): { contentType: string } | { error: string } {
  const normalizedType = String(contentType ?? "").toLowerCase().split(";")[0].trim();

  if (!SUPPORTED_DOCUMENT_CONTENT_TYPES.has(normalizedType)) {
    return { error: "Pilih dokumen berformat JPEG, PNG, WebP, atau PDF" };
  }
  if (bytes.byteLength === 0) {
    return { error: "Pilih file dokumen yang tidak kosong" };
  }
  if (bytes.byteLength > MAX_LOGISTICS_RECEIPT_IMAGE_BYTES) {
    return { error: "Ukuran dokumen maksimal 5 MB" };
  }
  if (!hasExpectedSignature(normalizedType, bytes)) {
    return { error: "File yang dipilih bukan dokumen yang valid" };
  }

  return { contentType: normalizedType };
}
