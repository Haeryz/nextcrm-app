import {
  calculateMektekVoucherDiscount,
  isMektekVoucherAvailable,
  toMektekVoucher,
  type MektekVoucherRecord,
} from "@/lib/mektek/vouchers";

const baseVoucher: MektekVoucherRecord = {
  id: "voucher-1",
  code: "MEKTEK-25",
  normalizedCode: "MEKTEK25",
  title: "Service voucher",
  description: "Discount for service orders",
  minSubtotal: 250000,
  discountType: "FIXED",
  discountAmount: 25000,
  discountPercent: null,
  maxDiscount: null,
  scope: "ALL",
  customerType: null,
  customerId: null,
  isActive: true,
  startsAt: null,
  expiresAt: null,
  usageLimit: null,
  usedCount: 0,
};

describe("MekTek voucher helpers", () => {
  it("allows active all-customer vouchers", () => {
    expect(isMektekVoucherAvailable(baseVoucher)).toBe(true);
  });

  it("requires matching customer type for customer-type vouchers", () => {
    const voucher: MektekVoucherRecord = {
      ...baseVoucher,
      scope: "CUSTOMER_TYPE",
      customerType: "B2B",
    };

    expect(isMektekVoucherAvailable(voucher, { customerType: "B2B" })).toBe(true);
    expect(isMektekVoucherAvailable(voucher, { customerType: "STANDARD" })).toBe(false);
  });

  it("requires matching customer for customer vouchers", () => {
    const voucher: MektekVoucherRecord = {
      ...baseVoucher,
      scope: "CUSTOMER",
      customerId: "customer-1",
    };

    expect(isMektekVoucherAvailable(voucher, { customerId: "customer-1" })).toBe(true);
    expect(isMektekVoucherAvailable(voucher, { customerId: "customer-2" })).toBe(false);
  });

  it("blocks inactive, expired, future, and usage-capped vouchers", () => {
    const now = new Date("2026-07-06T12:00:00.000Z");

    expect(
      isMektekVoucherAvailable({ ...baseVoucher, isActive: false }, { now })
    ).toBe(false);
    expect(
      isMektekVoucherAvailable(
        { ...baseVoucher, expiresAt: "2026-07-05T23:59:59.999Z" },
        { now }
      )
    ).toBe(false);
    expect(
      isMektekVoucherAvailable(
        { ...baseVoucher, startsAt: "2026-07-07T00:00:00.000Z" },
        { now }
      )
    ).toBe(false);
    expect(
      isMektekVoucherAvailable(
        { ...baseVoucher, usageLimit: 1, usedCount: 1 },
        { now }
      )
    ).toBe(false);
  });

  it("calculates fixed and capped percentage discounts", () => {
    const fixedVoucher = toMektekVoucher(baseVoucher);
    const percentageVoucher = toMektekVoucher({
      ...baseVoucher,
      discountType: "PERCENTAGE",
      discountAmount: null,
      discountPercent: 10,
      maxDiscount: 30000,
    });

    expect(calculateMektekVoucherDiscount(fixedVoucher, 300000)).toBe(25000);
    expect(calculateMektekVoucherDiscount(percentageVoucher, 500000)).toBe(30000);
    expect(calculateMektekVoucherDiscount(fixedVoucher, 200000)).toBe(0);
  });
});
