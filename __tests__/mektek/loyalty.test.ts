import {
  calculateMektekDiscountAmount,
  getMektekDiscountTier,
} from "@/lib/mektek/loyalty";

describe("MekTek loyalty helpers", () => {
  it("selects the highest eligible tier from completed visits", () => {
    expect(getMektekDiscountTier(0)).toBeNull();
    expect(getMektekDiscountTier(3)?.label).toBe("Silver");
    expect(getMektekDiscountTier(6)?.label).toBe("Gold");
    expect(getMektekDiscountTier(11)?.label).toBe("Platinum");
  });

  it("applies percentage discounts to the full subtotal", () => {
    expect(calculateMektekDiscountAmount(250000, 3)).toEqual({
      tier: { minVisits: 3, discount: 5, label: "Silver" },
      discountRate: 5,
      discountAmount: 12500,
    });
  });
});
