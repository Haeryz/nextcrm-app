export type FinancePurchaseOrderSource = {
  id: string;
  poNumber: string;
  poMode?: "MANUAL" | "CONSIGNMENT";
  userName: string;
  projectName: string;
  inputDate: Date;
  dueDate: Date;
  deliveryNoteNumber: string | null;
  deliveryDate: Date | null;
  items: Array<{
    position: number;
    partName: string;
    partNumber: string | null;
    orderedQuantity: number;
    agreedUnitPrice: unknown;
  }>;
};

export const MIN_FINANCE_PURCHASE_ORDER_QUERY_LENGTH = 3;

export function shouldSearchFinancePurchaseOrders(query: string) {
  return query.trim().length >= MIN_FINANCE_PURCHASE_ORDER_QUERY_LENGTH;
}

export function normalizeFinancePurchaseOrderNumber(value: string) {
  return value.trim().toLocaleLowerCase("id-ID");
}

/** A single billable line carried alongside a PO/Surat Jalan suggestion. */
export type FinancePurchaseOrderItemSuggestion = {
  description: string;
  partNumber: string;
  quantity: string;
  unitPrice: string;
};

export type FinancePurchaseOrderSuggestion = {
  id: string;
  poNumber: string;
  poMode: "MANUAL" | "CONSIGNMENT";
  customerName: string;
  projectName: string;
  purchaseOrderDate: string;
  dueDate: string;
  deliveryNoteNumber: string;
  deliveryNoteDate: string;
  description: string;
  subtotal: string;
  pricingComplete: boolean;
  items: FinancePurchaseOrderItemSuggestion[];
  deliveryNotes: FinancePurchaseOrderDeliveryNoteSuggestion[];
  totalDeliveryNoteCount: number;
};

export function findExactFinancePurchaseOrderSuggestion(
  suggestions: FinancePurchaseOrderSuggestion[],
  query: string,
) {
  const normalizedQuery = normalizeFinancePurchaseOrderNumber(query);
  return suggestions.find(
    (suggestion) =>
      normalizeFinancePurchaseOrderNumber(suggestion.poNumber) ===
      normalizedQuery,
  );
}

export type FinancePurchaseOrderDeliveryNoteSuggestion = {
  id: string;
  number: string;
  date: string;
  description: string;
  subtotal: string;
  pricingComplete: boolean;
  items: FinancePurchaseOrderItemSuggestion[];
};

export type FinancePurchaseOrderDeliveryNoteSource = {
  id: string;
  sourceReference: string;
  occurredAt: Date;
  subtotal: unknown;
  snapshot: unknown;
};

const dateKey = (date: Date | null) => date?.toISOString().slice(0, 10) ?? "";

export function buildFinancePurchaseOrderDeliveryNoteSuggestion(
  source: FinancePurchaseOrderDeliveryNoteSource,
): FinancePurchaseOrderDeliveryNoteSuggestion {
  const snapshot =
    source.snapshot && typeof source.snapshot === "object"
      ? (source.snapshot as Record<string, unknown>)
      : {};
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const structuredItems: FinancePurchaseOrderItemSuggestion[] = items.flatMap(
    (value) => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      const description = String(item.description ?? item.name ?? "").trim();
      if (!description) return [];
      const unitPrice = item.unitPrice ?? item.agreedUnitPrice;
      return [
        {
          description,
          partNumber: String(item.partNumber ?? "").trim(),
          quantity: String(Number(item.quantity ?? 0)),
          unitPrice:
            unitPrice == null || String(unitPrice).trim() === ""
              ? ""
              : String(unitPrice),
        },
      ];
    },
  );
  const description = items
    .flatMap((value, index) => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      const name = String(item.description ?? item.name ?? "").trim();
      if (!name) return [];
      const partNumber = String(item.partNumber ?? "").trim();
      const quantity = Number(item.quantity ?? 0);
      return [
        `${index + 1}. ${name}${partNumber ? ` (${partNumber})` : ""} × ${quantity}`,
      ];
    })
    .join("\n");
  const subtotal =
    source.subtotal == null ? "" : String(source.subtotal);

  return {
    id: source.id,
    number: source.sourceReference,
    date: dateKey(source.occurredAt),
    description,
    subtotal,
    pricingComplete:
      subtotal !== "" && Number.isFinite(Number(subtotal)),
    items: structuredItems,
  };
}

export function buildFinancePurchaseOrderSuggestion(
  purchaseOrder: FinancePurchaseOrderSource,
  deliveryNotes: FinancePurchaseOrderDeliveryNoteSuggestion[] = [],
  totalDeliveryNoteCount = deliveryNotes.length,
): FinancePurchaseOrderSuggestion {
  const items = [...purchaseOrder.items].sort(
    (left, right) => left.position - right.position,
  );
  const pricingComplete =
    items.length > 0 && items.every((item) => item.agreedUnitPrice != null);
  const subtotal = pricingComplete
    ? items.reduce(
        (sum, item) =>
          sum +
          Number(String(item.agreedUnitPrice)) * item.orderedQuantity,
        0,
      )
    : null;
  const itemDescription = items
    .map(
      (item, index) =>
        `${index + 1}. ${item.partName}${
          item.partNumber ? ` (${item.partNumber})` : ""
        } × ${item.orderedQuantity}`,
    )
    .join("\n");
  const description = [
    purchaseOrder.projectName
      ? `Project: ${purchaseOrder.projectName}`
      : "",
    itemDescription,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,
    poMode: purchaseOrder.poMode ?? "MANUAL",
    customerName: purchaseOrder.userName,
    projectName: purchaseOrder.projectName,
    purchaseOrderDate: dateKey(purchaseOrder.inputDate),
    dueDate: dateKey(purchaseOrder.dueDate),
    deliveryNoteNumber: purchaseOrder.deliveryNoteNumber ?? "",
    deliveryNoteDate: dateKey(purchaseOrder.deliveryDate),
    description,
    subtotal:
      subtotal != null && Number.isFinite(subtotal) ? String(subtotal) : "",
    pricingComplete:
      pricingComplete && subtotal != null && Number.isFinite(subtotal),
    items: items.map((item) => ({
      description: item.partName,
      partNumber: item.partNumber ?? "",
      quantity: String(item.orderedQuantity),
      unitPrice:
        item.agreedUnitPrice == null ? "" : String(item.agreedUnitPrice),
    })),
    deliveryNotes,
    totalDeliveryNoteCount,
  };
}
