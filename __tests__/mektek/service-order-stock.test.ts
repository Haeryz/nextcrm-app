import {
  calculateServiceOrderStockAdjustments,
  validateServiceOrderStockItems,
} from "@/lib/mektek/service-order-stock";

describe("service order stock", () => {
  const frontItem = {
    catalogItemId: "filter-1",
    quantity: 2,
    stockWarehouse: "FRONT" as const,
  };

  it("creates OUT adjustments when an order allocates catalogue spareparts", () => {
    expect(calculateServiceOrderStockAdjustments([], [frontItem])).toEqual([
      {
        catalogItemId: "filter-1",
        warehouse: "FRONT",
        direction: "OUT",
        quantity: 2,
      },
    ]);
  });

  it("only takes the quantity difference when an item quantity increases", () => {
    expect(
      calculateServiceOrderStockAdjustments(
        [frontItem],
        [{ ...frontItem, quantity: 5 }],
      ),
    ).toEqual([
      {
        catalogItemId: "filter-1",
        warehouse: "FRONT",
        direction: "OUT",
        quantity: 3,
      },
    ]);
  });

  it("returns the quantity difference when an item quantity decreases", () => {
    expect(
      calculateServiceOrderStockAdjustments(
        [{ ...frontItem, quantity: 5 }],
        [frontItem],
      ),
    ).toEqual([
      {
        catalogItemId: "filter-1",
        warehouse: "FRONT",
        direction: "IN",
        quantity: 3,
      },
    ]);
  });

  it("returns old stock and takes new stock when the warehouse changes", () => {
    expect(
      calculateServiceOrderStockAdjustments(
        [frontItem],
        [{ ...frontItem, stockWarehouse: "REAR" }],
      ),
    ).toEqual([
      {
        catalogItemId: "filter-1",
        warehouse: "FRONT",
        direction: "IN",
        quantity: 2,
      },
      {
        catalogItemId: "filter-1",
        warehouse: "REAR",
        direction: "OUT",
        quantity: 2,
      },
    ]);
  });

  it("returns all allocated stock when an order is cancelled", () => {
    expect(calculateServiceOrderStockAdjustments([frontItem], [])).toEqual([
      {
        catalogItemId: "filter-1",
        warehouse: "FRONT",
        direction: "IN",
        quantity: 2,
      },
    ]);
  });

  it("ignores manual and legacy spareparts without a stock warehouse", () => {
    expect(
      calculateServiceOrderStockAdjustments(
        [],
        [
          { catalogItemId: null, quantity: 2, stockWarehouse: null },
          {
            catalogItemId: "legacy-1",
            quantity: 1,
            stockWarehouse: null,
          },
        ],
      ),
    ).toEqual([]);
  });

  it("does not write fractional meter usage into the whole-unit stock ledger", () => {
    expect(
      calculateServiceOrderStockAdjustments(
        [],
        [
          {
            catalogItemId: "hose-half",
            quantity: 2.5,
            unit: "M",
            stockWarehouse: "FRONT",
          },
        ],
      ),
    ).toEqual([]);
  });

  it("requires a warehouse for every new catalogue sparepart", () => {
    expect(
      validateServiceOrderStockItems([
        {
          catalogItemId: "filter-1",
          name: "Filter oli",
          quantity: 1,
          stockWarehouse: null,
        },
      ]),
    ).toEqual("Pilih gudang untuk sparepart Filter oli");
  });
});
