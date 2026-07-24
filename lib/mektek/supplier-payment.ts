export type SupplierPayableLine = {
  sourceLineKey: string | null;
  description: string;
  partNumber: string | null;
  quantity: number;
  unitCost: number;
  lineTotal: number;
};

export type SupplierPayableSnapshot = {
  purchaseOrderId: string | null;
  poNumber: string;
  projectName: string;
  lines: SupplierPayableLine[];
  pricingComplete: boolean;
  expectedSubtotal: number | null;
  pricingIssues: SupplierPayablePricingIssue[];
};

export type SupplierPayablePricingIssue = {
  description: string;
  partNumber: string | null;
  quantity: number;
  reason: "MISSING_UNIT_COST";
};

const cleanText = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const finiteNonNegative = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export function parseSupplierPayableSnapshot(
  snapshot: unknown,
): SupplierPayableSnapshot {
  const record =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? (snapshot as Record<string, unknown>)
      : {};
  const rawItems = Array.isArray(record.items) ? record.items : [];
  let pricingComplete = rawItems.length > 0;
  const pricingIssues: SupplierPayablePricingIssue[] = [];

  const lines = rawItems.flatMap((value): SupplierPayableLine[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      pricingComplete = false;
      return [];
    }
    const item = value as Record<string, unknown>;
    const description = cleanText(item.description ?? item.name);
    const quantity = finiteNonNegative(item.quantity);
    const unitCost = finiteNonNegative(item.unitCost ?? item.unitPrice);
    if (description && quantity !== null && quantity > 0 && unitCost === null) {
      pricingIssues.push({
        description,
        partNumber: cleanText(item.partNumber) || null,
        quantity,
        reason: "MISSING_UNIT_COST",
      });
    }
    if (!description || quantity === null || quantity <= 0 || unitCost === null) {
      pricingComplete = false;
      return [];
    }
    return [
      {
        sourceLineKey: cleanText(item.sourceLineKey ?? item.id) || null,
        description,
        partNumber: cleanText(item.partNumber) || null,
        quantity,
        unitCost,
        lineTotal: quantity * unitCost,
      },
    ];
  });

  if (lines.length !== rawItems.length) pricingComplete = false;
  const expectedSubtotal = pricingComplete
    ? lines.reduce((sum, line) => sum + line.lineTotal, 0)
    : null;

  return {
    purchaseOrderId: cleanText(record.purchaseOrderId) || null,
    poNumber: cleanText(record.poNumber),
    projectName: cleanText(record.projectName),
    lines,
    pricingComplete,
    expectedSubtotal,
    pricingIssues,
  };
}

export function calculateSupplierPayable(
  subtotalValue: unknown,
  taxValue: unknown,
) {
  const subtotal = finiteNonNegative(subtotalValue) ?? 0;
  const taxAmount = finiteNonNegative(taxValue) ?? 0;
  return {
    subtotal,
    taxAmount,
    grandTotal: subtotal + taxAmount,
  };
}
