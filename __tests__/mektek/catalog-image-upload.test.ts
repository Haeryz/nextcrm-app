import {
  MAX_CATALOG_IMAGE_BYTES,
  validateCatalogImageUpload,
} from "@/lib/mektek/catalog-image-upload";

describe("validateCatalogImageUpload", () => {
  it.each([
    ["image/jpeg", [0xff, 0xd8, 0xff, 0x00]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["image/gif", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    [
      "image/webp",
      [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
    ],
  ])("accepts a supported %s signature", (contentType, bytes) => {
    expect(validateCatalogImageUpload(contentType, new Uint8Array(bytes))).toEqual({
      contentType,
    });
  });

  it("rejects SVG and other unsupported content types", () => {
    expect(
      validateCatalogImageUpload(
        "image/svg+xml",
        new TextEncoder().encode("<svg></svg>"),
      ),
    ).toEqual({ error: "Choose a JPEG, PNG, WebP, or GIF image" });
  });

  it("rejects a file whose signature does not match its declared type", () => {
    expect(
      validateCatalogImageUpload("image/png", new Uint8Array([0xff, 0xd8, 0xff])),
    ).toEqual({ error: "The selected file is not a valid image" });
  });

  it("rejects empty and oversized files", () => {
    expect(validateCatalogImageUpload("image/jpeg", new Uint8Array())).toEqual({
      error: "Choose a non-empty image file",
    });
    expect(
      validateCatalogImageUpload(
        "image/jpeg",
        new Uint8Array(MAX_CATALOG_IMAGE_BYTES + 1),
      ),
    ).toEqual({ error: "Catalogue images must be 4 MB or smaller" });
  });
});
