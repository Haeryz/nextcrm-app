export type MektekLineItemInput = {
  description?: string;
  estimatedCost?: string | number;
  quantity?: number;
  catalogItemId?: string;
  machine?: string;
  partNumber?: string;
  catalogPartNumber?: string;
  stockWarehouse?: "FRONT" | "REAR";
};

export type MektekLineItemKind = "service" | "sparepart";
export type MektekLineItemSource = "manual" | "catalog";

export type MektekLineItem = {
  kind: MektekLineItemKind;
  source: MektekLineItemSource;
  catalogItemId: string | null;
  name: string;
  machine: string | null;
  partNumber: string | null;
  catalogPartNumber: string | null;
  stockWarehouse: "FRONT" | "REAR" | null;
  quantity: number;
  unit: "JOB" | "PCS" | "M";
  unitPrice: number;
  total: number;
};

const METER_BASED_CATALOG_ITEM_IDS = new Set([
  "spare-part-2026-0805-1bb9832cf80c1b38",
  "spare-part-2026-0804-c9e7e33d6e01640e",
  "spare-part-2026-0803-02ed76f72b84d64f",
  "spare-part-2026-0808-e387d8e18e538672",
  "spare-part-2026-0370-734348b0d63ddacc",
  "spare-part-2026-0167-33bea5df50cf6e23",
  "spare-part-2026-0824-14b33e919c7a12cf",
]);

const METER_BASED_CATALOG_ITEM_NAMES = new Set([
  "hose12",
  "hose38",
  "hose58",
  "hosedischargeassyhd7",
  "hose",
  "everseal",
  "hirotape",
]);

const compactMeterItemName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, "");

export function isMeterBasedMektekCatalogItem(item: {
  catalogItemId?: string | null;
  name?: string | null;
  description?: string | null;
}) {
  const catalogItemId = item.catalogItemId?.trim();
  if (!catalogItemId) return false;
  if (METER_BASED_CATALOG_ITEM_IDS.has(catalogItemId)) return true;

  return METER_BASED_CATALOG_ITEM_NAMES.has(
    compactMeterItemName(item.name ?? item.description),
  );
}

export function normalizeMektekItemQuantity(
  value: unknown,
  usesMeters: boolean,
) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  if (!usesMeters) return Math.max(1, Math.floor(parsed));
  return Math.max(0.001, Math.round(parsed * 1000) / 1000);
}

export const haveRequiredMektekItemPrices = (
  items: ReadonlyArray<Pick<MektekLineItem, "unitPrice">>,
) =>
  items.every(
    (item) => Number.isFinite(item.unitPrice) && item.unitPrice > 0,
  );

type JsonRecord = Record<string, unknown>;

const parseMoney = (value: unknown) => {
  const rawValue = String(value ?? "");
  if (/-\s*\d/.test(rawValue)) return 0;

  const cleaned = rawValue.replace(/\D/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

export const haveRequiredMektekItemInputPrices = (
  items: ReadonlyArray<Pick<MektekLineItemInput, "estimatedCost">>,
) => items.every((item) => parseMoney(item.estimatedCost) > 0);

const usesMeterUnit = (item: MektekLineItemInput) =>
  isMeterBasedMektekCatalogItem({
    catalogItemId: item.catalogItemId,
    description: item.description,
  });

export const mergeMektekLineItemInputs = <T extends MektekLineItemInput>(
  items: ReadonlyArray<T>,
): T[] => {
  const merged: T[] = [];
  const itemIndexes = new Map<string, number>();

  for (const item of items) {
    const catalogItemId = item.catalogItemId?.trim() ?? "";
    const description = item.description?.trim() ?? "";
    const stockWarehouse =
      item.stockWarehouse === "FRONT" || item.stockWarehouse === "REAR"
        ? item.stockWarehouse
        : "";
    const identity = catalogItemId
      ? `catalog:${catalogItemId}:${stockWarehouse}`
      : description
        ? `manual:${description.toLocaleLowerCase("id-ID")}`
        : "";

    const matchingIndex = identity ? itemIndexes.get(identity) : undefined;
    if (matchingIndex === undefined) {
      if (identity) itemIndexes.set(identity, merged.length);
      merged.push({ ...item });
      continue;
    }

    const current = merged[matchingIndex];
    const usesMeters = usesMeterUnit(current) || usesMeterUnit(item);
    merged[matchingIndex] = {
      ...current,
      description: current.description?.trim() || description,
      estimatedCost: current.estimatedCost || item.estimatedCost,
      quantity: normalizeMektekItemQuantity(
        normalizeMektekItemQuantity(current.quantity, usesMeters) +
          normalizeMektekItemQuantity(item.quantity, usesMeters),
        usesMeters,
      ),
    };
  }

  return merged;
};

const toStringOrNull = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : null;
};

const toLineItem = (
  item: MektekLineItemInput | JsonRecord,
  kind: MektekLineItemKind
): MektekLineItem | null => {
  const row = item as JsonRecord;
  const name =
    typeof row.name === "string"
      ? row.name.trim()
      : typeof row.description === "string"
      ? row.description.trim()
      : "";
  if (!name) return null;

  const catalogItemId = toStringOrNull(row.catalogItemId);
  const usesMeters =
    kind === "sparepart" &&
    isMeterBasedMektekCatalogItem({ catalogItemId, name });
  const quantity = normalizeMektekItemQuantity(row.quantity, usesMeters);
  const unitPrice = parseMoney(row.unitPrice ?? row.estimatedCost);
  const total = parseMoney(row.total) || unitPrice * quantity;
  const stockWarehouse =
    row.stockWarehouse === "FRONT" || row.stockWarehouse === "REAR"
      ? row.stockWarehouse
      : null;

  return {
    kind,
    source: catalogItemId ? "catalog" : "manual",
    catalogItemId,
    name,
    machine: toStringOrNull(row.machine),
    partNumber: toStringOrNull(row.partNumber),
    catalogPartNumber: toStringOrNull(row.catalogPartNumber),
    stockWarehouse,
    quantity,
    unit: kind === "service" ? "JOB" : usesMeters ? "M" : "PCS",
    unitPrice,
    total,
  };
};

const parseStoredItems = (
  items: unknown,
  kind: MektekLineItemKind
): MektekLineItem[] =>
  Array.isArray(items)
    ? items
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          return toLineItem(item as JsonRecord, kind);
        })
        .filter((item): item is MektekLineItem => !!item)
    : [];

const parseContentFallback = (content?: string | null): MektekLineItem[] => {
  if (!content) return [];

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const estimateMatch = line.match(/\(Est\.\s*Rp\s*([^)]+)\)\s*$/i);
      const unitPrice = estimateMatch ? parseMoney(estimateMatch[1]) : 0;
      const name = estimateMatch ? line.replace(estimateMatch[0], "").trim() : line;
      return toLineItem(
        {
          description: name,
          estimatedCost: unitPrice,
          quantity: 1,
        },
        "service"
      );
    })
    .filter((item): item is MektekLineItem => !!item);
};

export const buildMektekStoredItems = (
  items: MektekLineItemInput[] | undefined,
  kind: MektekLineItemKind
) =>
  mergeMektekLineItemInputs(Array.isArray(items) ? items : [])
    .map((item) => toLineItem(item, kind))
    .filter((item): item is MektekLineItem => !!item);

export const normalizeMektekLineItems = (
  tags: unknown,
  content?: string | null
) => {
  const record =
    tags && typeof tags === "object" && !Array.isArray(tags)
      ? (tags as JsonRecord)
      : {};

  const hasSplitArrays =
    Array.isArray(record.serviceItems) || Array.isArray(record.sparepartItems);

  let serviceItems = parseStoredItems(record.serviceItems, "service");
  let sparepartItems = parseStoredItems(record.sparepartItems, "sparepart");

  if (!hasSplitArrays) {
    const legacyItems = Array.isArray(record.items) ? record.items : [];
    serviceItems = [];
    sparepartItems = [];

    for (const item of legacyItems) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const row = item as JsonRecord;
      const kind = toStringOrNull(row.catalogItemId) ? "sparepart" : "service";
      const normalized = toLineItem(row, kind);
      if (!normalized) continue;
      if (kind === "service") serviceItems.push(normalized);
      else sparepartItems.push(normalized);
    }
  }

  if (serviceItems.length === 0 && sparepartItems.length === 0) {
    serviceItems = parseContentFallback(content);
  }

  const serviceSubtotal = serviceItems.reduce((sum, item) => sum + item.total, 0);
  const sparepartSubtotal = sparepartItems.reduce((sum, item) => sum + item.total, 0);
  const items = [...serviceItems, ...sparepartItems];

  return {
    serviceItems,
    sparepartItems,
    items,
    serviceSubtotal,
    sparepartSubtotal,
    subtotal: serviceSubtotal + sparepartSubtotal,
  };
};

export const appendMektekLineItems = (
  tags: unknown,
  content: string | null | undefined,
  additions: {
    serviceItems?: MektekLineItemInput[];
    sparepartItems?: MektekLineItemInput[];
  },
) => {
  const current = normalizeMektekLineItems(tags, content);
  const mergeItems = (
    existing: MektekLineItem[],
    added: MektekLineItem[],
  ) => {
    const merged = existing.map((item) => ({ ...item }));

    for (const addition of added) {
      const normalizedName = addition.name.trim().toLocaleLowerCase("id-ID");
      const matchingIndex = merged.findIndex((item) =>
        addition.catalogItemId && item.catalogItemId
          ? addition.catalogItemId === item.catalogItemId
          : item.name.trim().toLocaleLowerCase("id-ID") === normalizedName,
      );
      if (matchingIndex < 0) {
        merged.push(addition);
        continue;
      }

      const currentItem = merged[matchingIndex];
      const quantity = currentItem.quantity + addition.quantity;
      merged[matchingIndex] = {
        ...currentItem,
        quantity,
        total: currentItem.unitPrice * quantity,
      };
    }

    return merged;
  };
  const serviceItems = mergeItems(
    current.serviceItems,
    buildMektekStoredItems(additions.serviceItems, "service"),
  );
  const sparepartItems = mergeItems(
    current.sparepartItems,
    buildMektekStoredItems(additions.sparepartItems, "sparepart"),
  );

  return normalizeMektekLineItems({ serviceItems, sparepartItems });
};

export { parseMoney };
