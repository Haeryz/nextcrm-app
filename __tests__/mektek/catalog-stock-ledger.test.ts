import { applyCatalogStockMovement } from "@/lib/mektek/catalog-stock-ledger";

function buildTransaction() {
  return {
    catalogItem: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    catalogInventoryMonth: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    catalogStockMovement: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
}

describe("Catalog stock ledger", () => {
  it("is idempotent for an integration source ID", async () => {
    const tx = buildTransaction();
    const existing = { id: "movement-existing" };
    tx.catalogStockMovement.findFirst.mockResolvedValue(existing);

    await expect(
      applyCatalogStockMovement(tx as never, {
        catalogItemId: "catalog-1",
        warehouse: "REAR",
        direction: "IN",
        quantity: 4,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
        source: "RECEIVING",
        sourceId: "receipt-1",
      }),
    ).resolves.toBe(existing);

    expect(tx.catalogStockMovement.findFirst).toHaveBeenCalledWith({
      where: { source: "RECEIVING", sourceId: "receipt-1" },
    });
    expect(tx.catalogItem.update).not.toHaveBeenCalled();
    expect(tx.catalogStockMovement.create).not.toHaveBeenCalled();
  });

  it("rejects outbound movement before stock can become negative", async () => {
    const tx = buildTransaction();
    tx.catalogStockMovement.findFirst.mockResolvedValue(null);
    tx.catalogItem.update.mockResolvedValue({ id: "catalog-1" });
    tx.catalogItem.findUnique.mockResolvedValue({
      id: "catalog-1",
      description: "Filter Element",
      rearStock: 2,
      frontStock: 0,
      inventoryMonths: [],
    });

    await expect(
      applyCatalogStockMovement(tx as never, {
        catalogItemId: "catalog-1",
        warehouse: "REAR",
        direction: "OUT",
        quantity: 3,
        occurredAt: new Date("2026-07-12T00:00:00.000Z"),
        source: "OUTBOUND_PO",
        sourceId: "po-item-1",
        preventNegativeStock: true,
      }),
    ).rejects.toThrow("Stok Filter Element tidak mencukupi (tersedia 2)");

    expect(tx.catalogStockMovement.create).not.toHaveBeenCalled();
  });

  it("writes an auditable movement and recomputes Catalog totals", async () => {
    const tx = buildTransaction();
    const occurredAt = new Date("2026-07-12T00:00:00.000Z");
    const movement = {
      id: "movement-1",
      warehouse: "FRONT",
      direction: "IN",
      quantity: 5,
      occurredAt,
    };
    tx.catalogStockMovement.findFirst.mockResolvedValue(null);
    tx.catalogItem.update.mockResolvedValue({ id: "catalog-1" });
    tx.catalogItem.findUnique.mockResolvedValue({
      id: "catalog-1",
      description: "Filter Element",
      rearStock: 10,
      frontStock: 3,
      inventoryMonths: [],
    });
    tx.catalogInventoryMonth.findUnique.mockResolvedValue(null);
    tx.catalogInventoryMonth.findFirst.mockResolvedValue(null);
    tx.catalogInventoryMonth.create.mockResolvedValue({ id: "month-1" });
    tx.catalogStockMovement.create.mockResolvedValue(movement);
    tx.catalogInventoryMonth.findMany.mockResolvedValue([
      {
        id: "month-1",
        month: new Date("2026-07-01T00:00:00.000Z"),
        openingRearStock: 10,
        openingFrontStock: 3,
        movements: [movement],
      },
    ]);

    await expect(
      applyCatalogStockMovement(tx as never, {
        catalogItemId: "catalog-1",
        warehouse: "FRONT",
        direction: "IN",
        quantity: 5,
        occurredAt,
        note: "Receiving PO-10",
        source: "RECEIVING",
        sourceId: "receipt-1",
      }),
    ).resolves.toBe(movement);

    expect(tx.catalogStockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        catalogItemId: "catalog-1",
        inventoryMonthId: "month-1",
        source: "RECEIVING",
        sourceId: "receipt-1",
        warehouse: "FRONT",
        direction: "IN",
        quantity: 5,
      }),
    });
    expect(tx.catalogItem.update).toHaveBeenLastCalledWith({
      where: { id: "catalog-1" },
      data: { rearStock: 10, frontStock: 8 },
    });
  });
});
