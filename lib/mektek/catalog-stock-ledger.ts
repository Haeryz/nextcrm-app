import type {
  CatalogStockDirection,
  CatalogStockMovementSource,
  CatalogWarehouse,
  Prisma,
} from "@prisma/client";

import {
  calculateCatalogInventoryMonth,
  getCatalogInventoryMonthKey,
  getCatalogInventoryMonthRange,
} from "@/lib/mektek/catalog-inventory";

type ApplyCatalogStockMovementInput = {
  catalogItemId: string;
  warehouse: CatalogWarehouse;
  direction: CatalogStockDirection;
  quantity: number;
  occurredAt: Date;
  note?: string | null;
  createdBy?: string | null;
  source?: CatalogStockMovementSource;
  sourceId?: string | null;
  preventNegativeStock?: boolean;
};

export async function recomputeCatalogInventoryFromMonth(
  tx: Prisma.TransactionClient,
  catalogItemId: string,
  fromMonth: Date,
  preventNegativeStock = false,
) {
  const previous = await tx.catalogInventoryMonth.findFirst({
    where: { catalogItemId, month: { lt: fromMonth } },
    orderBy: { month: "desc" },
    select: { closingRearStock: true, closingFrontStock: true },
  });
  const ledgers = await tx.catalogInventoryMonth.findMany({
    where: { catalogItemId, month: { gte: fromMonth } },
    orderBy: { month: "asc" },
    include: { movements: true },
  });
  if (ledgers.length === 0) return;

  let openingRearStock = previous?.closingRearStock ?? ledgers[0].openingRearStock;
  let openingFrontStock = previous?.closingFrontStock ?? ledgers[0].openingFrontStock;

  for (const ledger of ledgers) {
    const calculated = calculateCatalogInventoryMonth({
      month: getCatalogInventoryMonthKey(new Date(ledger.month)),
      openingRearStock,
      openingFrontStock,
      movements: ledger.movements,
    });
    if (
      preventNegativeStock &&
      (calculated.closingRearStock < 0 || calculated.closingFrontStock < 0)
    ) {
      throw new Error("Stok Catalog tidak mencukupi untuk mutasi keluar ini");
    }
    await tx.catalogInventoryMonth.update({
      where: { id: ledger.id },
      data: {
        openingRearStock,
        openingFrontStock,
        closingRearStock: calculated.closingRearStock,
        closingFrontStock: calculated.closingFrontStock,
      },
    });
    openingRearStock = calculated.closingRearStock;
    openingFrontStock = calculated.closingFrontStock;
  }

  await tx.catalogItem.update({
    where: { id: catalogItemId },
    data: { rearStock: openingRearStock, frontStock: openingFrontStock },
  });
}

export async function applyCatalogStockMovement(
  tx: Prisma.TransactionClient,
  input: ApplyCatalogStockMovementInput,
) {
  const source = input.source ?? "MANUAL";
  if (input.sourceId) {
    const existing = await tx.catalogStockMovement.findFirst({
      where: { source, sourceId: input.sourceId },
    });
    if (existing) return existing;
  }

  // A harmless write serializes stock changes for the same item. Callers that
  // update multiple items must process catalogItemId values in sorted order.
  await tx.catalogItem.update({
    where: { id: input.catalogItemId },
    data: { updatedAt: new Date() },
  });
  const item = await tx.catalogItem.findUnique({
    where: { id: input.catalogItemId },
    select: {
      id: true,
      description: true,
      rearStock: true,
      frontStock: true,
      inventoryMonths: {
        orderBy: { month: "asc" },
        take: 1,
        select: { month: true },
      },
    },
  });
  if (!item) throw new Error("Catalogue Item tidak ditemukan");

  if (input.direction === "OUT" && input.preventNegativeStock) {
    const available = input.warehouse === "REAR" ? item.rearStock : item.frontStock;
    if (available < input.quantity) {
      throw new Error(
        `Stok ${item.description} tidak mencukupi (tersedia ${available})`,
      );
    }
  }

  const range = getCatalogInventoryMonthRange(
    getCatalogInventoryMonthKey(input.occurredAt),
  );
  const firstMonth = item.inventoryMonths[0]?.month;
  if (firstMonth && range.start < firstMonth) {
    throw new Error(
      `Mutasi tidak boleh sebelum bulan stok awal (${getCatalogInventoryMonthKey(firstMonth)})`,
    );
  }

  let ledger = await tx.catalogInventoryMonth.findUnique({
    where: {
      catalogItemId_month: {
        catalogItemId: input.catalogItemId,
        month: range.start,
      },
    },
  });
  if (!ledger) {
    const previous = await tx.catalogInventoryMonth.findFirst({
      where: { catalogItemId: input.catalogItemId, month: { lt: range.start } },
      orderBy: { month: "desc" },
    });
    const openingRearStock = previous?.closingRearStock ?? item.rearStock;
    const openingFrontStock = previous?.closingFrontStock ?? item.frontStock;
    ledger = await tx.catalogInventoryMonth.create({
      data: {
        catalogItemId: input.catalogItemId,
        month: range.start,
        openingRearStock,
        openingFrontStock,
        closingRearStock: openingRearStock,
        closingFrontStock: openingFrontStock,
      },
    });
  }

  const movement = await tx.catalogStockMovement.create({
    data: {
      catalogItemId: input.catalogItemId,
      inventoryMonthId: ledger.id,
      warehouse: input.warehouse,
      direction: input.direction,
      quantity: input.quantity,
      occurredAt: input.occurredAt,
      note: input.note || null,
      source,
      sourceId: input.sourceId || null,
      createdBy: input.createdBy || null,
    },
  });
  await recomputeCatalogInventoryFromMonth(
    tx,
    input.catalogItemId,
    range.start,
    input.preventNegativeStock,
  );
  return movement;
}
