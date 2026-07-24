import crypto from "node:crypto";
import {
  CatalogStockMovementSource,
  type Prisma,
} from "@prisma/client";

import { applyCatalogStockMovement } from "@/lib/mektek/catalog-stock-ledger";
import {
  calculateServiceOrderStockAdjustments,
  type ServiceOrderStockItem,
} from "@/lib/mektek/service-order-stock";

type SyncServiceOrderStockInput = {
  serviceOrderId: string;
  serviceNumber?: string | null;
  previousItems: ReadonlyArray<ServiceOrderStockItem>;
  nextItems: ReadonlyArray<ServiceOrderStockItem>;
  createdBy: string;
  reason: string;
};

const serviceOrderStockSource: CatalogStockMovementSource =
  CatalogStockMovementSource.SERVICE_ORDER ??
  CatalogStockMovementSource.MANUAL;

export async function syncServiceOrderStock(
  tx: Prisma.TransactionClient,
  input: SyncServiceOrderStockInput,
) {
  const adjustments = calculateServiceOrderStockAdjustments(
    input.previousItems,
    input.nextItems,
  );

  for (const adjustment of adjustments) {
    await applyCatalogStockMovement(tx, {
      catalogItemId: adjustment.catalogItemId,
      warehouse: adjustment.warehouse,
      direction: adjustment.direction,
      quantity: adjustment.quantity,
      occurredAt: new Date(),
      note: [
        input.serviceNumber
          ? `Order servis ${input.serviceNumber}`
          : `Order servis ${input.serviceOrderId}`,
        input.reason,
      ].join(" · "),
      source: serviceOrderStockSource,
      sourceId: [
        input.serviceOrderId,
        adjustment.catalogItemId,
        adjustment.warehouse,
        crypto.randomUUID(),
      ].join(":"),
      createdBy: input.createdBy,
      preventNegativeStock: adjustment.direction === "OUT",
    });
  }

  return adjustments;
}
