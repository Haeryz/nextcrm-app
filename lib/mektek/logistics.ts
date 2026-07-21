export const LOGISTICS_PURCHASE_ORDER_STATUSES = ["OPEN", "CLOSED"] as const;

export type LogisticsPurchaseOrderStatus =
  (typeof LOGISTICS_PURCHASE_ORDER_STATUSES)[number];

export type LogisticsQuantityInput = {
  orderedQuantity: number;
  receivedQuantity: number;
};

export function normalizeLogisticsReference(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function getLogisticsItemProgress({
  orderedQuantity,
  receivedQuantity,
}: LogisticsQuantityInput) {
  if (!Number.isInteger(orderedQuantity) || orderedQuantity <= 0) {
    throw new Error("QTY Order harus berupa angka bulat lebih dari 0");
  }
  if (!Number.isInteger(receivedQuantity) || receivedQuantity < 0) {
    throw new Error("QTY Masuk harus berupa angka bulat 0 atau lebih");
  }
  if (receivedQuantity > orderedQuantity) {
    throw new Error("QTY Masuk tidak boleh melebihi QTY Order");
  }

  const remainingQuantity = orderedQuantity - receivedQuantity;
  return {
    orderedQuantity,
    receivedQuantity,
    remainingQuantity,
    status: (remainingQuantity === 0 ? "CLOSED" : "OPEN") as LogisticsPurchaseOrderStatus,
  };
}

export function validateLogisticsReceipt({
  orderedQuantity,
  receivedQuantity,
  incomingQuantity,
}: LogisticsQuantityInput & { incomingQuantity: number }) {
  if (!Number.isInteger(incomingQuantity) || incomingQuantity <= 0) {
    return { error: "QTY Masuk harus berupa angka bulat lebih dari 0" } as const;
  }

  let current: ReturnType<typeof getLogisticsItemProgress>;
  try {
    current = getLogisticsItemProgress({ orderedQuantity, receivedQuantity });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Quantity PO tidak valid",
    } as const;
  }

  if (incomingQuantity > current.remainingQuantity) {
    return {
      error: `QTY Masuk melebihi QTY Sisa (${current.remainingQuantity})`,
    } as const;
  }

  return {
    data: getLogisticsItemProgress({
      orderedQuantity,
      receivedQuantity: receivedQuantity + incomingQuantity,
    }),
  } as const;
}

export function getLogisticsPurchaseOrderStatus(items: LogisticsQuantityInput[]) {
  if (items.length === 0) return "OPEN" as const;
  return items.every(
    (item) => getLogisticsItemProgress(item).status === "CLOSED",
  )
    ? ("CLOSED" as const)
    : ("OPEN" as const);
}

export function getLogisticsStatusLabel(status: LogisticsPurchaseOrderStatus) {
  return status === "CLOSED" ? "Closed" : "Open";
}
