export type MektekCustomerType = "STANDARD" | "B2B";

const COMPANY_PREFIX = /^\s*(?:PT|CV)\.?\s+/i;

export function inferMektekCustomerType(
  name: unknown,
  fallback: MektekCustomerType = "STANDARD",
): MektekCustomerType {
  return COMPANY_PREFIX.test(String(name ?? "")) ? "B2B" : fallback;
}

export function resolveMektekCustomerNames(input: {
  companyName?: unknown;
  contactName?: unknown;
}) {
  const companyName = String(input.companyName ?? "").trim();
  const contactName = String(input.contactName ?? "").trim();

  return {
    customerName: companyName || contactName,
    companyName: companyName || null,
    contactName: contactName || null,
  };
}
