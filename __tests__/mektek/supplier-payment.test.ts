import {
  calculateSupplierPayable,
  parseSupplierPayableSnapshot,
} from "@/lib/mektek/supplier-payment";

describe("supplier payment three-document matching", () => {
  const snapshot = {
    purchaseOrderId: "po-id",
    poNumber: "MTL/LOG-PO/VII/26/MTL0407263",
    projectName: "TANJUNG",
    items: [
      {
        id: "item-1",
        sourceLineKey: "item-1:SJ-001",
        name: "PULLEY TRANSFER 220MM",
        partNumber: "PT-220",
        quantity: 8,
        unitCost: "5675000",
      },
      {
        id: "item-2",
        sourceLineKey: "item-2:SJ-001",
        description: "AS PULLEY PTO TRANSFER",
        quantity: 15,
        unitCost: "275000",
      },
    ],
  };

  it("extracts the PO and priced line items supplied by Logistics", () => {
    expect(parseSupplierPayableSnapshot(snapshot)).toEqual({
      purchaseOrderId: "po-id",
      poNumber: "MTL/LOG-PO/VII/26/MTL0407263",
      projectName: "TANJUNG",
      lines: [
        {
          sourceLineKey: "item-1:SJ-001",
          description: "PULLEY TRANSFER 220MM",
          partNumber: "PT-220",
          quantity: 8,
          unitCost: 5_675_000,
          lineTotal: 45_400_000,
        },
        {
          sourceLineKey: "item-2:SJ-001",
          description: "AS PULLEY PTO TRANSFER",
          partNumber: null,
          quantity: 15,
          unitCost: 275_000,
          lineTotal: 4_125_000,
        },
      ],
      pricingComplete: true,
      expectedSubtotal: 49_525_000,
      pricingIssues: [],
    });
  });

  it("calculates the grand total from the matched PO subtotal and supplier tax", () => {
    expect(calculateSupplierPayable(49_525_000, 5_447_750)).toEqual({
      subtotal: 49_525_000,
      taxAmount: 5_447_750,
      grandTotal: 54_972_750,
    });
  });

  it("marks incomplete Logistics pricing instead of silently calculating zero", () => {
    expect(
      parseSupplierPayableSnapshot({
        ...snapshot,
        items: [{ name: "ITEM TANPA HARGA", quantity: 1, unitCost: null }],
      }),
    ).toEqual(
      expect.objectContaining({
        pricingComplete: false,
        expectedSubtotal: null,
        pricingIssues: [
          {
            description: "ITEM TANPA HARGA",
            partNumber: null,
            quantity: 1,
            reason: "MISSING_UNIT_COST",
          },
        ],
      }),
    );
  });
});
