import crypto from "crypto";

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

type VoucherContext = {
  customerId?: string | null;
  phoneNormalized: string;
  completedVisitCount: number;
};

function cleanCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function voucherSuffix(context: VoucherContext) {
  const seed = context.phoneNormalized;
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 6).toUpperCase();
}

function formatVoucherCode(prefix: string, context: VoucherContext) {
  return `${prefix}-${voucherSuffix(context)}`;
}

function isVisitEligible(context: VoucherContext, minVisits: number) {
  return context.completedVisitCount >= minVisits;
}

export function buildMektekVouchers(context: VoucherContext): MektekVoucher[] {
  const vouchers: Omit<MektekVoucher, "code" | "available">[] = [
    {
      id: "welcome",
      title: "Welcome voucher",
      description: "Rp25.000 off the next MekTek service.",
      minSubtotal: 250000,
      discount: { type: "fixed", amount: 25000 },
      requirement: "Available for every customer account",
    },
    {
      id: "service5",
      title: "Service saver",
      description: "5% off service work, capped at Rp75.000.",
      minSubtotal: 300000,
      discount: { type: "percentage", percent: 5, maxDiscount: 75000 },
      requirement: "Available for every customer account",
    },
    {
      id: "parts10",
      title: "Sparepart deal",
      description: "10% off orders with spareparts, capped at Rp150.000.",
      minSubtotal: 500000,
      discount: { type: "percentage", percent: 10, maxDiscount: 150000 },
      requirement: "Available for every customer account",
    },
    {
      id: "silver",
      title: "Silver loyalty",
      description: "5% loyalty discount for returning customers.",
      minSubtotal: 0,
      discount: { type: "percentage", percent: 5 },
      requirement: "Requires 3 completed services",
    },
    {
      id: "gold",
      title: "Gold loyalty",
      description: "10% loyalty discount for frequent customers.",
      minSubtotal: 0,
      discount: { type: "percentage", percent: 10 },
      requirement: "Requires 6 completed services",
    },
    {
      id: "platinum",
      title: "Platinum loyalty",
      description: "15% loyalty discount for top customers.",
      minSubtotal: 0,
      discount: { type: "percentage", percent: 15 },
      requirement: "Requires 11 completed services",
    },
  ];

  return vouchers.map((voucher) => ({
    ...voucher,
    code: formatVoucherCode(`MEKTEK-${voucher.id.toUpperCase()}`, context),
    available:
      voucher.id === "silver"
        ? isVisitEligible(context, 3)
        : voucher.id === "gold"
          ? isVisitEligible(context, 6)
          : voucher.id === "platinum"
            ? isVisitEligible(context, 11)
            : true,
  }));
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

export function findMektekVoucherByCode(
  context: VoucherContext,
  code: string
) {
  const normalizedCode = cleanCode(code);
  if (!normalizedCode) return null;

  return (
    buildMektekVouchers(context).find(
      (voucher) => cleanCode(voucher.code) === normalizedCode
    ) ?? null
  );
}
