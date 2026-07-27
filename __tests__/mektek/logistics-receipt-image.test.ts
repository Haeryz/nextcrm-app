import {
  MAX_LOGISTICS_RECEIPT_IMAGE_BYTES,
  validateLogisticsDocumentUpload,
  validateLogisticsReceiptImageUpload,
} from "@/lib/mektek/logistics-receipt-image";

describe("Logistics received-item condition image validation", () => {
  it("accepts a JPEG signature", () => {
    expect(
      validateLogisticsReceiptImageUpload(
        "image/jpeg",
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      ),
    ).toEqual({ contentType: "image/jpeg" });
  });

  it("rejects unsupported and oversized files", () => {
    expect(
      validateLogisticsReceiptImageUpload("application/pdf", new Uint8Array([1, 2, 3])),
    ).toEqual({ error: "Pilih foto kondisi barang berformat JPEG, PNG, atau WebP" });
    expect(
      validateLogisticsReceiptImageUpload(
        "image/jpeg",
        new Uint8Array(MAX_LOGISTICS_RECEIPT_IMAGE_BYTES + 1),
      ),
    ).toEqual({ error: "Ukuran foto kondisi barang maksimal 5 MB" });
  });
});

describe("Logistics document upload validation (PO Customer, signed PO, etc.)", () => {
  it("accepts a valid PDF", () => {
    const pdfBytes = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
    ]);
    expect(
      validateLogisticsDocumentUpload("application/pdf", pdfBytes),
    ).toEqual({ contentType: "application/pdf" });
  });

  it("accepts a valid JPEG", () => {
    expect(
      validateLogisticsDocumentUpload(
        "image/jpeg",
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      ),
    ).toEqual({ contentType: "image/jpeg" });
  });

  it("rejects unsupported types", () => {
    expect(
      validateLogisticsDocumentUpload("text/plain", new Uint8Array([1, 2, 3])),
    ).toEqual({ error: "Pilih dokumen berformat JPEG, PNG, WebP, atau PDF" });
  });

  it("rejects a file whose bytes do not match the declared PDF signature", () => {
    expect(
      validateLogisticsDocumentUpload("application/pdf", new Uint8Array([1, 2, 3])),
    ).toEqual({ error: "File yang dipilih bukan dokumen yang valid" });
  });

  it("rejects oversized documents", () => {
    expect(
      validateLogisticsDocumentUpload(
        "application/pdf",
        new Uint8Array(MAX_LOGISTICS_RECEIPT_IMAGE_BYTES + 1),
      ),
    ).toEqual({ error: "Ukuran dokumen maksimal 5 MB" });
  });
});
