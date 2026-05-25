export const statusMap: Record<string, { label: string }> = {
  ACTIVE: { label: "In Progress" },
  PENDING: { label: "Pending" },
  COMPLETE: { label: "Done" },
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
    case "COMPLETE": return { label: "Done",        badgeVariant: "default" };
    case "PENDING":  return { label: "Pending",     badgeVariant: "secondary" };
    default:         return { label: "In Progress", badgeVariant: "secondary" };
  }
}
