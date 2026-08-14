import {
  buildSupplyConflictContext,
  type SupplyAllocationApprovalRow,
} from "@/lib/mektek/supply-conflict-approval";

const allocation = (
  overrides: Partial<SupplyAllocationApprovalRow>,
): SupplyAllocationApprovalRow => ({
  allocationId: "allocation-current",
  purchaseOrderId: "po-current",
  poNumber: "PO-MANUAL-001",
  poMode: "MANUAL",
  purchaseOrderStatus: "OPEN",
  customerName: "PT Contoh",
  projectName: "Proyek A",
  counterpartyId: "customer-1",
  projectKey: "proyeka",
  itemKey: "receiverdryer",
  itemName: "Receiver Dryer",
  partNumber: "447810-0150",
  quantity: 3,
  supplyStartDate: "2026-08-01",
  supplyEndDate: "2026-08-31",
  reviewStatus: "BLOCKED",
  ...overrides,
});

describe("supply-conflict approval context", () => {
  it("shows the opposing PO when mode, item, project, customer, and period overlap", () => {
    const context = buildSupplyConflictContext("po-current", [
      allocation({}),
      allocation({
        allocationId: "allocation-conflict",
        purchaseOrderId: "po-consignment",
        poNumber: "PO-CONS-002",
        poMode: "CONSIGNMENT",
        quantity: 5,
        supplyStartDate: "2026-08-10",
        supplyEndDate: "2026-09-10",
        reviewStatus: "CLEAR",
      }),
    ]);

    expect(context?.blockedPurchaseOrder.poNumber).toBe("PO-MANUAL-001");
    expect(context?.blockedPurchaseOrder.items).toHaveLength(1);
    expect(context?.conflictingPurchaseOrders).toEqual([
      expect.objectContaining({
        purchaseOrderId: "po-consignment",
        poNumber: "PO-CONS-002",
        poMode: "CONSIGNMENT",
        items: [expect.objectContaining({ partNumber: "447810-0150" })],
      }),
    ]);
  });

  it("does not report same-mode, different-item, or non-overlapping allocations", () => {
    const context = buildSupplyConflictContext("po-current", [
      allocation({}),
      allocation({
        allocationId: "same-mode",
        purchaseOrderId: "po-same-mode",
        poMode: "MANUAL",
      }),
      allocation({
        allocationId: "different-item",
        purchaseOrderId: "po-different-item",
        poMode: "CONSIGNMENT",
        itemKey: "compressor",
      }),
      allocation({
        allocationId: "later-period",
        purchaseOrderId: "po-later",
        poMode: "CONSIGNMENT",
        supplyStartDate: "2026-09-01",
        supplyEndDate: "2026-09-30",
      }),
    ]);

    expect(context).toBeNull();
  });
});
