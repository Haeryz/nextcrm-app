export const FINANCE_INVOICE_SIGNERS = ["SUYADI", "WATI"] as const;

export type FinanceInvoiceSigner = (typeof FINANCE_INVOICE_SIGNERS)[number];

export function isFinanceInvoiceSigner(
  value: unknown,
): value is FinanceInvoiceSigner {
  return FINANCE_INVOICE_SIGNERS.includes(value as FinanceInvoiceSigner);
}
