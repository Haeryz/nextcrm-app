export const MAX_CATALOG_IMAGE_BYTES = 4 * 1024 * 1024;

const SUPPORTED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
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
  if (contentType === "image/gif") {
    return (
      startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
      startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    );
  }
  if (contentType === "image/webp") {
    return (
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
    );
  }
  return false;
}

export function validateCatalogImageUpload(
  contentType: string | null,
  bytes: Uint8Array,
): { contentType: string } | { error: string } {
  const normalizedType = String(contentType ?? "").toLowerCase().split(";")[0].trim();

  if (!SUPPORTED_CONTENT_TYPES.has(normalizedType)) {
    return { error: "Choose a JPEG, PNG, WebP, or GIF image" };
  }
  if (bytes.byteLength === 0) {
    return { error: "Choose a non-empty image file" };
  }
  if (bytes.byteLength > MAX_CATALOG_IMAGE_BYTES) {
    return { error: "Catalogue images must be 4 MB or smaller" };
  }
  if (!hasExpectedSignature(normalizedType, bytes)) {
    return { error: "The selected file is not a valid image" };
  }

  return { contentType: normalizedType };
}
