import { normalizeMektekLineItems, parseMoney } from "@/lib/mektek/items";

type JsonRecord = Record<string, unknown>;

export type MektekPaymentRecord = {
  id?: string | null;
  midtransOrderId?: string | null;
  grossAmount?: number | null;
  paymentType?: string | null;
  transactionStatus?: string | null;
  fraudStatus?: string | null;
  paidAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type MektekPaymentDetail = {
  id: string;
  midtransOrderId: string;
  grossAmount: number;
  paymentType: string | null;
  transactionStatus: string;
  fraudStatus: string | null;
  paidAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  isPaid: boolean;
};

const PAID_PROVIDER_STATUSES = new Set(["capture", "paid", "settlement"]);
export const MEKTEK_PPN_RATE = 0.11;
export const MEKTEK_PPH_RATE = 0.02;

const parseTags = (tags: unknown): JsonRecord => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as JsonRecord;
};

const toIsoString = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
};

const normalizeProviderPayments = (
  payments: MektekPaymentRecord[] | undefined
): MektekPaymentDetail[] =>
  (Array.isArray(payments) ? payments : [])
    .map((payment) => {
      const status = String(payment.transactionStatus ?? "").toLowerCase();
      const paidAt = toIsoString(payment.paidAt);
      return {
        id: String(payment.id ?? ""),
        midtransOrderId: String(payment.midtransOrderId ?? ""),
        grossAmount: parseMoney(payment.grossAmount),
        paymentType:
          typeof payment.paymentType === "string" && payment.paymentType.trim()
            ? payment.paymentType
            : null,
        transactionStatus: status || "pending",
        fraudStatus:
          typeof payment.fraudStatus === "string" && payment.fraudStatus.trim()
            ? payment.fraudStatus
            : null,
        paidAt,
        createdAt: toIsoString(payment.createdAt),
        updatedAt: toIsoString(payment.updatedAt),
        isPaid: !!paidAt || PAID_PROVIDER_STATUSES.has(status),
      };
    })
    .filter((payment) => payment.midtransOrderId && payment.grossAmount > 0)
    .sort((a, b) => {
      const aTime = new Date(a.createdAt ?? a.paidAt ?? 0).getTime();
      const bTime = new Date(b.createdAt ?? b.paidAt ?? 0).getTime();
      return bTime - aTime;
    });

const parsePayment = (tags: JsonRecord) => {
  const payment =
    tags.payment && typeof tags.payment === "object" && !Array.isArray(tags.payment)
      ? (tags.payment as JsonRecord)
      : {};
  return {
    method: typeof payment.method === "string" ? payment.method : "cash",
    amountPaid: parseMoney(payment.amountPaid),
    status: typeof payment.status === "string" ? payment.status : "",
  };
};

export function buildMektekFinancialSummary(
  tags: unknown,
  content?: string | null,
  payments?: MektekPaymentRecord[]
) {
  const parsedTags = parseTags(tags);
  const normalizedItems = normalizeMektekLineItems(parsedTags, content);
  const subtotal = normalizedItems.subtotal;
  const discount = parseMoney(parsedTags.discount);
  const taxBase = Math.max(0, subtotal - discount);
  const customerType: "STANDARD" | "B2B" =
    parsedTags.customerType === "B2B" ? "B2B" : "STANDARD";
  const ppnEnabled = customerType === "B2B" && parsedTags.ppnEnabled !== false;
  const pphEnabled = customerType === "B2B" && parsedTags.pphEnabled !== false;
  const tax = ppnEnabled ? Math.round(taxBase * MEKTEK_PPN_RATE) : 0;
  const pphBase = normalizedItems.serviceSubtotal;
  const pph = pphEnabled ? Math.round(pphBase * MEKTEK_PPH_RATE) : 0;
  const grossInvoiceTotal = Math.max(0, taxBase + tax + pph);
  // Kept as compatibility aliases for payment/invoice consumers.
  const netPayable = grossInvoiceTotal;
  const grandTotal = netPayable;
  const payment = parsePayment(parsedTags);
  const providerPayments = normalizeProviderPayments(payments);
  const paidProviderPayments = providerPayments.filter((item) => item.isPaid);
  const providerAmountPaid = paidProviderPayments.reduce(
    (sum, item) => sum + item.grossAmount,
    0
  );
  const manualAmountPaid =
    payment.status === "paid" && payment.amountPaid === 0
      ? grandTotal
      : payment.amountPaid;
  const amountPaid = Math.min(
    Math.max(manualAmountPaid, providerAmountPaid),
    grandTotal
  );
  const balanceDue = Math.max(0, grandTotal - amountPaid);
  const paymentStatus: "paid" | "partial" | "unpaid" =
    amountPaid >= grandTotal && grandTotal > 0
      ? "paid"
      : amountPaid > 0
      ? "partial"
      : "unpaid";
  const latestPaidProviderPayment = paidProviderPayments[0] ?? null;

  return {
    normalizedItems,
    serviceSubtotal: normalizedItems.serviceSubtotal,
    sparepartSubtotal: normalizedItems.sparepartSubtotal,
    subtotal,
    discount,
    taxBase,
    pphBase,
    tax,
    pph,
    customerType,
    ppnEnabled,
    pphEnabled,
    ppnRate: MEKTEK_PPN_RATE,
    pphRate: MEKTEK_PPH_RATE,
    grossInvoiceTotal,
    netPayable,
    grandTotal,
    amountPaid,
    balanceDue,
    providerPayments,
    payment: {
      method: latestPaidProviderPayment?.paymentType ?? payment.method,
      status: paymentStatus,
      providerAmountPaid,
      providerPayments,
    },
  };
}
