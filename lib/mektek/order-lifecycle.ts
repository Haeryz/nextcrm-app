type LifecycleInput = {
  taskStatus?: string | null;
  tags?: unknown;
  balanceDue: number;
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

export function canEditMektekOrderItems(taskStatus?: string | null) {
  return taskStatus === "ACTIVE" || taskStatus === "PENDING";
}

export function canTransitionMektekOrderStatus(
  currentStatus?: string | null,
  nextStatus?: string | null,
) {
  return currentStatus !== "COMPLETE" || nextStatus === "COMPLETE";
}

export function isMektekPaymentAvailable(input: LifecycleInput) {
  if (!Number.isFinite(input.balanceDue) || input.balanceDue <= 0) return false;
  if (input.taskStatus === "COMPLETE") return false;

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
