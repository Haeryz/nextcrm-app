import { randomBytes } from "node:crypto";

const CUSTOMER_NUMBER_PREFIX = "PLG";

export function createMektekCustomerNumber(): string {
  return `${CUSTOMER_NUMBER_PREFIX}-${randomBytes(5)
    .toString("hex")
    .toUpperCase()}`;
}

export function formatMektekCustomerNumber(
  customerNumber: string | null | undefined,
  internalId: string | null | undefined,
): string {
  const storedNumber = customerNumber?.trim();
  if (storedNumber) return storedNumber;

  const compactId = internalId?.replaceAll("-", "").slice(0, 10).toUpperCase();
  return compactId ? `${CUSTOMER_NUMBER_PREFIX}-${compactId}` : "-";
}
