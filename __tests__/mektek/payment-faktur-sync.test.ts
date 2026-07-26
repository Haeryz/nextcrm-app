import { readFileSync } from "fs";
import { resolve } from "path";

const read = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Payment Faktur synchronisation", () => {
  const syncSource = read("lib/mektek/payment-faktur-sync.ts");
  const financeSource = read("actions/mektek/finance.ts");
  const logisticsSource = read("actions/mektek/logistics.ts");

  it("creates the Payment Faktur row when an invoice is saved", () => {
    expect(financeSource).toContain(
      'import { syncInvoiceToPaymentFaktur } from "@/lib/mektek/payment-faktur-sync"',
    );
    // Both the create and the update path mirror the invoice across.
    expect(
      financeSource.match(/await syncInvoiceToPaymentFaktur\(/g),
    ).toHaveLength(2);
  });

  it("is idempotent on the customer and invoice number", () => {
    expect(syncSource).toContain("const existing = await tx.paymentFakturEntry.findFirst");
    expect(syncSource).toContain(
      "invoiceNumber: { equals: invoiceNumber, mode: \"insensitive\" }",
    );
    expect(syncSource).toContain("tx.paymentFakturEntry.update");
  });

  it("never overwrites recorded installments", () => {
    expect(syncSource).not.toContain("installment1");
    expect(syncSource).not.toContain("installment2");
    expect(syncSource).not.toContain("installment3");
    expect(syncSource).not.toContain("transferDate");
  });

  it("registers a new company from an outbound Purchase Order", () => {
    expect(logisticsSource).toContain(
      'import { ensurePaymentFakturCustomer } from "@/lib/mektek/payment-faktur-sync"',
    );
    expect(logisticsSource).toContain(
      "await ensurePaymentFakturCustomer(tx, header.data.userName)",
    );
  });

  it("reuses an existing customer sheet before creating one", () => {
    expect(syncSource).toContain(
      "customerName: { equals: name, mode: \"insensitive\" }",
    );
    expect(syncSource).toContain("tx.paymentFakturCustomer.findUnique");
    expect(syncSource).toContain("normalizeFinanceKey(name)");
  });

  it("continues the imported workbook row numbering", () => {
    expect(syncSource).toContain("FIRST_GENERATED_SOURCE_ROW = 15");
    expect(syncSource).toContain("orderBy: { sourceRow: \"desc\" }");
  });

  it("computes the grand total from the invoice values", () => {
    expect(syncSource).toContain(
      "grandTotal: invoice.subtotal.add(invoice.taxAmount)",
    );
  });
});
