export type MektekLineItemInput = {
  description?: string;
  estimatedCost?: string | number;
  quantity?: number;
  catalogItemId?: string;
  machine?: string;
  partNumber?: string;
  catalogPartNumber?: string;
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
  quantity: number;
  unit: "JOB" | "PCS";
  unitPrice: number;
  total: number;
};

type JsonRecord = Record<string, unknown>;

const parseMoney = (value: unknown) => {
  const cleaned = String(value ?? "").replace(/\D/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const parseQuantity = (value: unknown) =>
  Math.max(1, Math.floor(Number(value) || 1));

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
  const quantity = parseQuantity(row.quantity);
  const unitPrice = parseMoney(row.unitPrice ?? row.estimatedCost);
  const total = parseMoney(row.total) || unitPrice * quantity;

  return {
    kind,
    source: catalogItemId ? "catalog" : "manual",
    catalogItemId,
    name,
    machine: toStringOrNull(row.machine),
    partNumber: toStringOrNull(row.partNumber),
    catalogPartNumber: toStringOrNull(row.catalogPartNumber),
    quantity,
    unit: kind === "service" ? "JOB" : "PCS",
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
  (Array.isArray(items) ? items : [])
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

export { parseMoney };
