// These labels are NOT staff-only. `getStatusMeta` below feeds the public
// customer tracking page (app/[locale]/service-status/[id]) — the link sent to
// customers over WhatsApp — and the customer profile card, so they must follow
// the Bahasa Indonesia policy like any other customer-facing copy.
export const statusMap: Record<string, { label: string }> = {
  ACTIVE: { label: "Sedang Dikerjakan" },
  PENDING: { label: "Menunggu" },
  AWAITING_PAYMENT: { label: "Servis Selesai · Menunggu Pembayaran" },
  COMPLETE: { label: "Selesai · Ditutup" },
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
      return { label: statusMap.COMPLETE.label, badgeVariant: "default" };
    case "CANCELLED":
      return { label: statusMap.CANCELLED.label, badgeVariant: "secondary" };
    case "AWAITING_PAYMENT":
      return { label: statusMap.AWAITING_PAYMENT.label, badgeVariant: "secondary" };
    case "PENDING":
      return { label: statusMap.PENDING.label, badgeVariant: "secondary" };
    default:
      return { label: statusMap.ACTIVE.label, badgeVariant: "secondary" };
  }
}
