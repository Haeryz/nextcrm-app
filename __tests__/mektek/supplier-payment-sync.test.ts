import { syncReceivingPayableSource } from "@/lib/mektek/finance-sync";

describe("Receiving PO to Finance payable synchronization", () => {
  it("refreshes an existing Finance snapshot from the saved Receiving item prices", async () => {
    const upsert = jest.fn().mockResolvedValue({ id: "source-id" });
    const tx = {
      logisticsPurchaseOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: "po-id",
          flow: "RECEIVING",
          poNumber: "PO-REC-001",
          projectName: "Project A",
          supplierName: "PT Supplier",
          financeCounterpartyId: "supplier-id",
          financeCounterparty: {
            id: "supplier-id",
            legalName: "PT Supplier",
            role: "SUPPLIER",
          },
          items: [
            {
              id: "item-id",
              partName: "Filter AC",
              partNumber: "145520-7855",
              agreedUnitPrice: { toString: () => "110000" },
              receipts: [{ quantity: 2 }],
            },
          ],
        }),
        update: jest.fn(),
      },
      financeCounterparty: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      financePayableSource: { upsert },
    };

    await syncReceivingPayableSource(tx as never, {
      purchaseOrderId: "po-id",
      receivingReference: "SJ-001",
      occurredAt: new Date("2026-07-24T00:00:00.000Z"),
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: "RECEIVING:po-id:SJ-001" },
        update: expect.objectContaining({
          subtotal: expect.objectContaining({ toNumber: expect.any(Function) }),
          totalAmount: expect.objectContaining({ toNumber: expect.any(Function) }),
          snapshot: expect.objectContaining({
            poNumber: "PO-REC-001",
            items: [
              expect.objectContaining({
                description: "Filter AC",
                quantity: 2,
                unitCost: "110000",
              }),
            ],
          }),
        }),
      }),
    );
    const update = upsert.mock.calls[0][0].update;
    expect(update.totalAmount.toNumber()).toBe(220_000);
  });
});
