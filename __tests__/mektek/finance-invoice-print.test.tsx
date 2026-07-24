import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FINANCE_DESTINATION_BANK_OPTIONS } from "@/lib/mektek/finance-bank-accounts";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("print-ready Finance invoice", () => {
  it("offers exactly the two approved destination accounts", () => {
    expect(FINANCE_DESTINATION_BANK_OPTIONS).toEqual([
      "Mandiri (031-00-1134863-1)",
      "BRI (0249-01-001068-30-2)",
    ]);
  });

  it("defines the print-ready item table, remittance, and signing sections", () => {
    const pdfSource = source("actions/mektek/finance-invoice-pdf.tsx");

    for (const label of [
      "DESCRIPTION",
      "PART NUMBER",
      "UNIT PRICE",
      "TOTAL PRICE",
      "Remittance Address",
      "Received by",
      "AUTHORIZED PERSON",
      "Finance Dept. Head",
      "GRAND TOTAL",
    ]) {
      expect(pdfSource).toContain(label);
    }
    expect(pdfSource).toContain("logo-pt-mektek-tanjung-lestari.jpg");
  });

  it("connects every saved invoice to the authorized PDF route", () => {
    const manager = source(
      "app/[locale]/(routes)/mektek/finance/_components/InvoiceCrudManager.tsx",
    );
    const route = source(
      "app/api/mektek/finance/invoices/[id]/pdf/route.ts",
    );

    expect(manager).toContain("/api/mektek/finance/invoices/");
    expect(manager).toContain("Unduh PDF");
    expect(route).toContain("canViewMektekFinance");
    expect(route).toContain("renderFinanceInvoicePdf");
    expect(route).toContain("source.snapshot");
  });
});
