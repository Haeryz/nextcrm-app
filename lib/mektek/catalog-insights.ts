export type CatalogInsightItem = {
  id: string;
  machine: string;
  description: string;
  partNumber: string | null;
  quantity: string | null;
  price: number | null;
  imagePath: string | null;
  createdAt: Date;
};

export type CatalogSalesRank = {
  catalogItemId: string | null;
  quantity: number;
};

const EMPTY_QUANTITY_LABEL = "Belum diisi";

export function formatQuantityChange(previousQuantity: string | null, quantity: string | null) {
  return `${previousQuantity?.trim() || EMPTY_QUANTITY_LABEL} → ${quantity?.trim() || EMPTY_QUANTITY_LABEL}`;
}

export function buildQuantityUpdateData(
  previousQuantity: string | null,
  quantity: string | null,
  changedAt = new Date(),
) {
  const previous = previousQuantity?.trim() || null;
  const next = quantity?.trim() || null;
  return previous === next
    ? {}
    : { previousQuantity: previous, quantityUpdatedAt: changedAt };
}

export function buildCatalogHighlights(catalogItems: CatalogInsightItem[], salesRanks: CatalogSalesRank[], limit = 4) {
  const itemsById = new Map(catalogItems.map((item) => [item.id, item]));
  const popular = salesRanks
    .filter((rank) => rank.catalogItemId && itemsById.has(rank.catalogItemId))
    .slice(0, limit)
    .map((rank) => ({ ...itemsById.get(rank.catalogItemId as string)!, soldQuantity: rank.quantity }));
  const newest = [...catalogItems]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit);
  return { popular, newest };
}
