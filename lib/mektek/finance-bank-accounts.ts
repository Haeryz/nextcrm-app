export const FINANCE_DESTINATION_BANK_OPTIONS = [
  "Mandiri (031-00-1134863-1)",
  "BRI (0249-01-001068-30-2)",
] as const;

export type FinanceDestinationBank =
  (typeof FINANCE_DESTINATION_BANK_OPTIONS)[number];

export function isFinanceDestinationBank(
  value: string,
): value is FinanceDestinationBank {
  return FINANCE_DESTINATION_BANK_OPTIONS.some((option) => option === value);
}
