export const statusMap: Record<string, { label: string; progress: number }> = {
  ACTIVE: { label: "In Progress", progress: 65 },
  PENDING: { label: "Pending", progress: 35 },
  COMPLETE: { label: "Completed", progress: 100 },
};

export const discountTiers: { minVisits: number; discount: number; label: string }[] = [
  { minVisits: 11, discount: 15, label: "Platinum" },
  { minVisits: 6,  discount: 10, label: "Gold" },
  { minVisits: 3,  discount: 5,  label: "Silver" },
  { minVisits: 1,  discount: 0,  label: "Member" },
];

export function getDiscountTier(visitCount: number) {
  return discountTiers.find((tier) => visitCount >= tier.minVisits) ?? null;
}
