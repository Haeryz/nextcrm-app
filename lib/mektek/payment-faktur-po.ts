import type { FinancePurchaseOrderSuggestion } from "@/lib/mektek/finance-po";

export type PaymentFakturPurchaseOrderAutofill = {
  purchaseOrderNumber: string;
  deliveryDate: string;
  description: string;
  subtotal: string | undefined;
  taxAmount: string | undefined;
};

export function buildPaymentFakturPurchaseOrderAutofill(
  suggestion: FinancePurchaseOrderSuggestion,
  taxPercent: number,
): PaymentFakturPurchaseOrderAutofill {
  const subtotal = Number(suggestion.subtotal);
  const pricingComplete =
    suggestion.pricingComplete &&
    suggestion.subtotal !== "" &&
    Number.isFinite(subtotal);

  return {
    purchaseOrderNumber: suggestion.poNumber,
    deliveryDate:
      suggestion.deliveryNoteDate || suggestion.purchaseOrderDate,
    description: suggestion.description,
    subtotal: pricingComplete ? suggestion.subtotal : undefined,
    taxAmount: pricingComplete
      ? String(
          (subtotal *
            (Number.isFinite(taxPercent) ? taxPercent : 0)) /
            100,
        )
      : undefined,
  };
}
