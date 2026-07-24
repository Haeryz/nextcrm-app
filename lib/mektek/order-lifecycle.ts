type LifecycleInput = {
  taskStatus?: string | null;
  tags?: unknown;
  balanceDue: number;
};

type DocumentAccessInput = {
  taskStatus?: string | null;
  tags?: unknown;
  paymentStatus?: "paid" | "partial" | "unpaid" | null;
};

const parseTags = (tags: unknown): Record<string, unknown> => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as Record<string, unknown>;
};

export function isMektekStorefrontPurchase(tags: unknown) {
  const record = parseTags(tags);
  return (
    record.orderSource === "customer_storefront" ||
    record.serviceType === "Sparepart Purchase"
  );
}

export function isMektekInvoiceAvailable(input: DocumentAccessInput) {
  return (
    input.paymentStatus === "paid" ||
    input.taskStatus === "AWAITING_PAYMENT" ||
    input.taskStatus === "COMPLETE" ||
    isMektekStorefrontPurchase(input.tags)
  );
}

export function isMektekReceiptAvailable(input: DocumentAccessInput) {
  return input.paymentStatus === "paid";
}

export function canEditMektekOrderItems(taskStatus?: string | null) {
  return taskStatus === "ACTIVE" || taskStatus === "PENDING";
}

export function canTransitionMektekOrderStatus(
  currentStatus?: string | null,
  nextStatus?: string | null,
) {
  if (currentStatus === "COMPLETE" || currentStatus === "CANCELLED") {
    return nextStatus === currentStatus;
  }
  if (nextStatus === "CANCELLED") {
    return currentStatus === "ACTIVE" || currentStatus === "PENDING";
  }
  return true;
}

export function isMektekPaymentAvailable(input: LifecycleInput) {
  if (!Number.isFinite(input.balanceDue) || input.balanceDue <= 0) return false;
  if (
    input.taskStatus === "COMPLETE" ||
    input.taskStatus === "CANCELLED"
  ) {
    return false;
  }

  return (
    input.taskStatus === "AWAITING_PAYMENT" ||
    isMektekStorefrontPurchase(input.tags)
  );
}

export function canFinalizeMektekOrder(input: LifecycleInput) {
  if (!Number.isFinite(input.balanceDue) || input.balanceDue > 0) return false;

  return (
    input.taskStatus === "AWAITING_PAYMENT" ||
    isMektekStorefrontPurchase(input.tags)
  );
}
