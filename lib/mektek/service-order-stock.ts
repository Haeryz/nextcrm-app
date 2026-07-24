export type ServiceOrderStockWarehouse = "FRONT" | "REAR";

export type ServiceOrderStockItem = {
  catalogItemId?: string | null;
  name?: string | null;
  quantity?: number | null;
  stockWarehouse?: ServiceOrderStockWarehouse | null;
};

export type ServiceOrderStockAdjustment = {
  catalogItemId: string;
  warehouse: ServiceOrderStockWarehouse;
  direction: "IN" | "OUT";
  quantity: number;
};

const normalizeQuantity = (quantity: number | null | undefined) =>
  Math.max(1, Math.floor(Number(quantity) || 1));

const allocationKey = (
  catalogItemId: string,
  warehouse: ServiceOrderStockWarehouse,
) => `${catalogItemId}\u0000${warehouse}`;

const aggregateAllocations = (
  items: ReadonlyArray<ServiceOrderStockItem>,
) => {
  const allocations = new Map<
    string,
    {
      catalogItemId: string;
      warehouse: ServiceOrderStockWarehouse;
      quantity: number;
    }
  >();

  for (const item of items) {
    const catalogItemId = item.catalogItemId?.trim();
    const warehouse = item.stockWarehouse;
    if (!catalogItemId || (warehouse !== "FRONT" && warehouse !== "REAR")) {
      continue;
    }

    const key = allocationKey(catalogItemId, warehouse);
    const current = allocations.get(key);
    allocations.set(key, {
      catalogItemId,
      warehouse,
      quantity: (current?.quantity ?? 0) + normalizeQuantity(item.quantity),
    });
  }

  return allocations;
};

export function validateServiceOrderStockItems(
  items: ReadonlyArray<ServiceOrderStockItem>,
) {
  for (const item of items) {
    if (
      item.catalogItemId?.trim() &&
      item.stockWarehouse !== "FRONT" &&
      item.stockWarehouse !== "REAR"
    ) {
      return `Pilih gudang untuk sparepart ${item.name?.trim() || item.catalogItemId}`;
    }
  }

  return null;
}

export function calculateServiceOrderStockAdjustments(
  previousItems: ReadonlyArray<ServiceOrderStockItem>,
  nextItems: ReadonlyArray<ServiceOrderStockItem>,
): ServiceOrderStockAdjustment[] {
  const previous = aggregateAllocations(previousItems);
  const next = aggregateAllocations(nextItems);
  const keys = [...new Set([...previous.keys(), ...next.keys()])].sort();
  const adjustments: ServiceOrderStockAdjustment[] = [];

  for (const key of keys) {
    const before = previous.get(key);
    const after = next.get(key);
    const difference = (after?.quantity ?? 0) - (before?.quantity ?? 0);
    if (difference === 0) continue;

    const allocation = after ?? before;
    if (!allocation) continue;

    adjustments.push({
      catalogItemId: allocation.catalogItemId,
      warehouse: allocation.warehouse,
      direction: difference > 0 ? "OUT" : "IN",
      quantity: Math.abs(difference),
    });
  }

  return adjustments.sort((left, right) => {
    const itemOrder = left.catalogItemId.localeCompare(right.catalogItemId);
    if (itemOrder !== 0) return itemOrder;
    if (left.direction !== right.direction) {
      return left.direction === "IN" ? -1 : 1;
    }
    return left.warehouse.localeCompare(right.warehouse);
  });
}
