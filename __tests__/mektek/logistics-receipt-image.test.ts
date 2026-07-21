import {
  MAX_LOGISTICS_RECEIPT_IMAGE_BYTES,
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
