import { normalizeMektekLineItems, parseMoney } from "@/lib/mektek/items";

type JsonRecord = Record<string, unknown>;

const parseTags = (tags: unknown): JsonRecord => {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as JsonRecord;
};

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

export function buildMektekFinancialSummary(tags: unknown, content?: string | null) {
  const parsedTags = parseTags(tags);
  const normalizedItems = normalizeMektekLineItems(parsedTags, content);
  const subtotal = normalizedItems.subtotal;
  const discount = parseMoney(parsedTags.discount);
  const taxBase = Math.max(0, subtotal - discount);
  const tax = parseMoney(parsedTags.tax) || Math.round(taxBase * 0.11);
  const pph = parseMoney(parsedTags.pph) || Math.round(taxBase * 0.02);
  const grandTotal = Math.max(0, taxBase + tax - pph);
  const payment = parsePayment(parsedTags);
  const amountPaid =
    payment.status === "paid" && payment.amountPaid === 0
      ? grandTotal
      : Math.min(payment.amountPaid, grandTotal);
  const balanceDue = Math.max(0, grandTotal - amountPaid);
  const paymentStatus: "paid" | "partial" | "unpaid" =
    amountPaid >= grandTotal && grandTotal > 0
      ? "paid"
      : amountPaid > 0
      ? "partial"
      : "unpaid";

  return {
    normalizedItems,
    serviceSubtotal: normalizedItems.serviceSubtotal,
    sparepartSubtotal: normalizedItems.sparepartSubtotal,
    subtotal,
    discount,
    taxBase,
    tax,
    pph,
    grandTotal,
    amountPaid,
    balanceDue,
    payment: {
      method: payment.method,
      status: paymentStatus,
    },
  };
}
