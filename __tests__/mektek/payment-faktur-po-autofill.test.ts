import {
  buildPaymentFakturPurchaseOrderAutofill,
} from "@/lib/mektek/payment-faktur-po";

describe("Payment Faktur PO autocomplete", () => {
  it("fills Logistics PO details and calculates PPN from a selected suggestion", () => {
    expect(
      buildPaymentFakturPurchaseOrderAutofill(
        {
          id: "po-1",
          poNumber: "123/PO/VII/2026",
          poMode: "MANUAL",
          customerName: "PT Pelanggan",
          projectName: "Site A",
          purchaseOrderDate: "2026-07-20",
          dueDate: "2026-08-20",
          deliveryNoteNumber: "SJ-123",
          deliveryNoteDate: "2026-07-22",
          description: "1. Filter × 2",
          subtotal: "300000",
          pricingComplete: true,
          deliveryNotes: [],
          totalDeliveryNoteCount: 0,
        },
        11,
      ),
    ).toEqual({
      purchaseOrderNumber: "123/PO/VII/2026",
      deliveryDate: "2026-07-22",
      description: "1. Filter × 2",
      subtotal: "300000",
      taxAmount: "33000",
    });
  });

  it("leaves monetary fields untouched when Logistics pricing is incomplete", () => {
    expect(
      buildPaymentFakturPurchaseOrderAutofill(
        {
          id: "po-2",
          poNumber: "PO-UNPRICED",
          poMode: "MANUAL",
          customerName: "PT Pelanggan",
          projectName: "Site B",
          purchaseOrderDate: "2026-07-20",
          dueDate: "2026-08-20",
          deliveryNoteNumber: "",
          deliveryNoteDate: "",
          description: "1. Filter × 2",
          subtotal: "",
          pricingComplete: false,
          deliveryNotes: [],
          totalDeliveryNoteCount: 0,
        },
        11,
      ),
    ).toEqual({
      purchaseOrderNumber: "PO-UNPRICED",
      deliveryDate: "2026-07-20",
      description: "1. Filter × 2",
      subtotal: undefined,
      taxAmount: undefined,
    });
  });
});
