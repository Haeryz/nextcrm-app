export const statusMap: Record<string, { label: string }> = {
  ACTIVE: { label: "In Progress" },
  PENDING: { label: "Pending" },
  AWAITING_PAYMENT: { label: "Service Done · Awaiting Payment" },
  COMPLETE: { label: "Done · Closed" },
  CANCELLED: { label: "Dibatalkan" },
};

export {
  mektekDiscountTiers as discountTiers,
  getMektekDiscountTier as getDiscountTier,
} from "@/lib/mektek/loyalty";

export function getStatusMeta(taskStatus: string | null | undefined): {
  label: string;
  badgeVariant: "default" | "secondary";
} {
  switch (taskStatus) {
    case "COMPLETE":
      return { label: "Done · Closed", badgeVariant: "default" };
    case "CANCELLED":
      return { label: "Dibatalkan", badgeVariant: "secondary" };
    case "AWAITING_PAYMENT":
      return { label: "Service Done · Awaiting Payment", badgeVariant: "secondary" };
    case "PENDING":
      return { label: "Pending", badgeVariant: "secondary" };
    default:
      return { label: "In Progress", badgeVariant: "secondary" };
  }
}
