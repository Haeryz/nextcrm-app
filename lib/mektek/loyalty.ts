export type MektekDiscountTier = {
  minVisits: number;
  discount: number;
  label: string;
};

export const mektekDiscountTiers: MektekDiscountTier[] = [
  { minVisits: 11, discount: 15, label: "Platinum" },
  { minVisits: 6, discount: 10, label: "Gold" },
  { minVisits: 3, discount: 5, label: "Silver" },
  { minVisits: 1, discount: 0, label: "Member" },
];

export function getMektekDiscountTier(completedVisits: number) {
  return mektekDiscountTiers.find((tier) => completedVisits >= tier.minVisits) ?? null;
}

export function calculateMektekDiscountAmount(
  subtotal: number,
  completedVisits: number
) {
  const tier = getMektekDiscountTier(completedVisits);
  const discountRate = tier?.discount ?? 0;
  return {
    tier,
    discountRate,
    discountAmount: Math.round(Math.max(0, subtotal) * (discountRate / 100)),
  };
}
