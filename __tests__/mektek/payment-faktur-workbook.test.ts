import * as path from "node:path";

import * as XLSX from "xlsx";

import {
  calculatePaymentFakturAmounts,
  extractPaymentFakturWorkbook,
} from "@/lib/mektek/payment-faktur";

describe("Payment Faktur workbook contract", () => {
  const workbookPath = path.join(
    process.cwd(),
    "data",
    "PAYMENT FAKTUR 2026.xlsx",
  );

  it("reads every customer sheet from sheet 3 onward without treating formulas as invoices", () => {
    const workbook = XLSX.readFile(workbookPath, {
      cellDates: true,
      cellFormula: true,
    });
    const extracted = extractPaymentFakturWorkbook(workbook);

    expect(extracted.customers).toHaveLength(43);
    expect(extracted.entries).toHaveLength(1584);
    expect(extracted.customers[0]).toMatchObject({
      sheetKey: "AL",
      customerName: "PT ADARO LOGISTICS",
      position: 1,
    });
    expect(extracted.customers.at(-1)).toMatchObject({
      sheetKey: "hillcon",
      customerName: "PT. HILLCONJAYA SAKTI",
      position: 43,
    });
  });

  it("maps the source columns and preserves duplicate invoice numbers", () => {
    const workbook = XLSX.readFile(workbookPath, {
      cellDates: true,
      cellFormula: true,
    });
    const extracted = extractPaymentFakturWorkbook(workbook);
    const adaro = extracted.entries.find(
      (entry) => entry.sheetKey === "AL" && entry.sourceRow === 15,
    );

    expect(adaro).toMatchObject({
      receiptNumber: "M025726",
      invoiceNumber: "MTL0068226",
      purchaseOrderNumber: "1130002975",
      description: "SERVICE AC RUANGAN",
      subtotal: 24_480_000,
      taxAmount: 2_692_800,
      grandTotal: 27_172_800,
      taxInvoiceNumber: "04002600104061655",
    });
    expect(
      extracted.entries.filter(
        (entry) => entry.invoiceNumber === "MTL0053026",
      ),
    ).toHaveLength(5);
  });

  it("recognizes both workbook PPN labels while preserving the entered tax amount", () => {
    const workbook = XLSX.readFile(workbookPath, {
      cellDates: true,
      cellFormula: true,
    });
    const extracted = extractPaymentFakturWorkbook(workbook);

    expect(new Set(extracted.customers.map((row) => row.taxLabelPercent))).toEqual(
      new Set([10, 11]),
    );
    expect(
      extracted.entries.every((entry) => Number.isFinite(entry.taxAmount)),
    ).toBe(true);
  });
});

describe("Payment Faktur calculated columns", () => {
  it("treats a transfer date as a full payment, matching column P", () => {
    expect(
      calculatePaymentFakturAmounts({
        grandTotal: 1_110_000,
        transferDate: new Date("2026-07-01"),
        installment1: 100_000,
        installment2: 0,
        installment3: 0,
      }),
    ).toEqual({ paidAmount: 1_110_000, remainingAmount: 0, status: "LUNAS" });
  });

  it("uses installments when there is no transfer date", () => {
    expect(
      calculatePaymentFakturAmounts({
        grandTotal: 1_110_000,
        transferDate: null,
        installment1: 300_000,
        installment2: 200_000,
        installment3: 0,
      }),
    ).toEqual({
      paidAmount: 500_000,
      remainingAmount: 610_000,
      status: "CICILAN",
    });
  });
});
