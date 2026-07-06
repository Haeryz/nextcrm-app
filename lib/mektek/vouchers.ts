export type MektekVoucherDiscount =
  | {
      type: "percentage";
      percent: number;
      maxDiscount?: number;
    }
  | {
      type: "fixed";
      amount: number;
    };

export type MektekVoucher = {
  id: string;
  code: string;
  title: string;
  description: string;
  minSubtotal: number;
  discount: MektekVoucherDiscount;
  requirement: string;
  available: boolean;
};

export type MektekVoucherScopeValue = "ALL" | "CUSTOMER_TYPE" | "CUSTOMER";
export type MektekVoucherDiscountTypeValue = "FIXED" | "PERCENTAGE";
export type MektekCustomerTypeValue = "STANDARD" | "B2B";

export type MektekVoucherRecord = {
  id: string;
  code: string;
  normalizedCode: string;
  title: string;
  description: string;
  minSubtotal: number;
  discountType: MektekVoucherDiscountTypeValue;
  discountAmount: number | null;
  discountPercent: number | null;
  maxDiscount: number | null;
  scope: MektekVoucherScopeValue;
  customerType: MektekCustomerTypeValue | null;
  customerId: string | null;
  isActive: boolean;
  startsAt: Date | string | null;
  expiresAt: Date | string | null;
  usageLimit: number | null;
  usedCount: number;
};

export type VoucherEligibilityContext = {
  customerId?: string | null;
  customerType?: MektekCustomerTypeValue | null;
  now?: Date;
};

export function cleanMektekVoucherCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function normalizeMektekVoucherCode(value: string) {
  return value
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

function toDate(value: Date | string | null) {
  return value ? new Date(value) : null;
}

function isWithinActiveWindow(
  voucher: MektekVoucherRecord,
  now = new Date()
) {
  const startsAt = toDate(voucher.startsAt);
  const expiresAt = toDate(voucher.expiresAt);

  if (startsAt && startsAt.getTime() > now.getTime()) return false;
  if (expiresAt && expiresAt.getTime() < now.getTime()) return false;

  return true;
}

export function isMektekVoucherAvailable(
  voucher: MektekVoucherRecord,
  context: VoucherEligibilityContext = {}
) {
  if (!voucher.isActive) return false;
  if (!isWithinActiveWindow(voucher, context.now)) return false;
  if (
    voucher.usageLimit !== null &&
    voucher.usageLimit !== undefined &&
    voucher.usedCount >= voucher.usageLimit
  ) {
    return false;
  }

  if (voucher.scope === "ALL") return true;

  if (voucher.scope === "CUSTOMER_TYPE") {
    return !!voucher.customerType && voucher.customerType === context.customerType;
  }

  return !!voucher.customerId && voucher.customerId === context.customerId;
}

function buildDiscount(voucher: MektekVoucherRecord): MektekVoucherDiscount {
  if (voucher.discountType === "FIXED") {
    return {
      type: "fixed",
      amount: Math.max(0, voucher.discountAmount ?? 0),
    };
  }

  return {
    type: "percentage",
    percent: Math.max(0, voucher.discountPercent ?? 0),
    ...(voucher.maxDiscount && voucher.maxDiscount > 0
      ? { maxDiscount: voucher.maxDiscount }
      : {}),
  };
}

function formatRequirement(voucher: MektekVoucherRecord) {
  if (voucher.scope === "CUSTOMER") return "Assigned to your customer account";
  if (voucher.scope === "CUSTOMER_TYPE") {
    return voucher.customerType === "B2B"
      ? "Available for B2B customers"
      : "Available for standard customers";
  }
  return "Available for every customer account";
}

export function toMektekVoucher(
  voucher: MektekVoucherRecord,
  context: VoucherEligibilityContext = {}
): MektekVoucher {
  return {
    id: voucher.id,
    code: voucher.code,
    title: voucher.title,
    description: voucher.description,
    minSubtotal: voucher.minSubtotal,
    discount: buildDiscount(voucher),
    requirement: formatRequirement(voucher),
    available: isMektekVoucherAvailable(voucher, context),
  };
}

export function calculateMektekVoucherDiscount(
  voucher: MektekVoucher,
  subtotal: number
) {
  if (!voucher.available) return 0;
  if (subtotal < voucher.minSubtotal) return 0;

  if (voucher.discount.type === "fixed") {
    return Math.min(voucher.discount.amount, subtotal);
  }

  const percentageDiscount = Math.round(subtotal * (voucher.discount.percent / 100));
  return voucher.discount.maxDiscount
    ? Math.min(percentageDiscount, voucher.discount.maxDiscount)
    : percentageDiscount;
}
