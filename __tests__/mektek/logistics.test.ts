import {
  calculateLogisticsPurchaseOrderTotal,
  getLogisticsItemProgress,
  getLogisticsPurchaseOrderStatus,
  normalizeLogisticsReference,
  validateLogisticsReceipt,
} from "@/lib/mektek/logistics";

describe("MekTek logistics purchase order progress", () => {
  it("calculates the PO total from every item quantity and unit price", () => {
    expect(
      calculateLogisticsPurchaseOrderTotal([
        { orderedQuantity: "2", agreedUnitPrice: "150000" },
        { orderedQuantity: "3", agreedUnitPrice: "50000" },
      ]),
    ).toEqual({ total: 450_000, pricingComplete: true });
  });

  it("does not present a partial PO total when an item price is missing", () => {
    expect(
      calculateLogisticsPurchaseOrderTotal([
        { orderedQuantity: "2", agreedUnitPrice: "150000" },
        { orderedQuantity: "3", agreedUnitPrice: "" },
      ]),
    ).toEqual({ total: null, pricingComplete: false });
  });

  it("keeps an unreceived or partially received item open", () => {
    expect(
      getLogisticsItemProgress({ orderedQuantity: 10, receivedQuantity: 0 }),
    ).toEqual({
      orderedQuantity: 10,
      receivedQuantity: 0,
      remainingQuantity: 10,
      status: "OPEN",
    });

    expect(
      getLogisticsItemProgress({ orderedQuantity: 10, receivedQuantity: 5 }),
    ).toEqual({
      orderedQuantity: 10,
      receivedQuantity: 5,
      remainingQuantity: 5,
      status: "OPEN",
    });
  });

  it("closes an item only when all ordered quantity has arrived", () => {
    expect(
      getLogisticsItemProgress({ orderedQuantity: 10, receivedQuantity: 10 }),
    ).toEqual({
      orderedQuantity: 10,
      receivedQuantity: 10,
      remainingQuantity: 0,
      status: "CLOSED",
    });
  });

  it("rejects a receipt that would exceed the remaining quantity", () => {
    expect(
      validateLogisticsReceipt({
        orderedQuantity: 10,
        receivedQuantity: 5,
        incomingQuantity: 6,
      }),
    ).toEqual({ error: "QTY Masuk melebihi QTY Sisa (5)" });
  });

  it("returns the next balance and status for a valid receipt", () => {
    expect(
      validateLogisticsReceipt({
        orderedQuantity: 10,
        receivedQuantity: 5,
        incomingQuantity: 5,
      }),
    ).toEqual({
      data: {
        orderedQuantity: 10,
        receivedQuantity: 10,
        remainingQuantity: 0,
        status: "CLOSED",
      },
    });
  });

  it("closes a PO only after every item is closed", () => {
    expect(
      getLogisticsPurchaseOrderStatus([
        { orderedQuantity: 10, receivedQuantity: 10 },
        { orderedQuantity: 10, receivedQuantity: 5 },
      ]),
    ).toBe("OPEN");
    expect(
      getLogisticsPurchaseOrderStatus([
        { orderedQuantity: 10, receivedQuantity: 10 },
        { orderedQuantity: 5, receivedQuantity: 5 },
      ]),
    ).toBe("CLOSED");
  });

  it("normalizes PO and delivery references for duplicate protection", () => {
    expect(normalizeLogisticsReference("  sj  /  001-a ")).toBe("SJ / 001-A");
  });
});
