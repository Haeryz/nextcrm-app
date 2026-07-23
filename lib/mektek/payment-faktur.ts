import type { WorkBook, WorkSheet } from "xlsx";

export type PaymentFakturStatus = "BELUM_BAYAR" | "CICILAN" | "LUNAS";

export type PaymentFakturWorkbookCustomer = {
  sheetKey: string;
  customerName: string;
  position: number;
  taxLabelPercent: number;
};

export type PaymentFakturWorkbookEntry = {
  sheetKey: string;
  sourceRow: number;
  receiptNumber: string | null;
  invoiceNumber: string;
  invoiceDate: Date | null;
  purchaseOrderNumber: string | null;
  deliveryDate: Date | null;
  description: string;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  transferDate: Date | null;
  taxInvoiceNumber: string | null;
  installment1: number;
  installment2: number;
  installment3: number;
};

const cellValue = (sheet: WorkSheet, address: string) => sheet[address]?.v;

const asText = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const asNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
    );
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

export function extractPaymentFakturWorkbook(workbook: WorkBook) {
  const customers: PaymentFakturWorkbookCustomer[] = [];
  const entries: PaymentFakturWorkbookEntry[] = [];

  for (let sheetIndex = 2; sheetIndex < workbook.SheetNames.length; sheetIndex += 1) {
    const sheetKey = workbook.SheetNames[sheetIndex];
    const sheet = workbook.Sheets[sheetKey];
    if (!sheet) continue;

    const customerName = asText(cellValue(sheet, "J11")) ?? sheetKey.trim();
    const taxHeader = asText(cellValue(sheet, "I12")) ?? "";
    const taxLabelPercent = Number(taxHeader.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(",", ".") ?? 0);
    customers.push({
      sheetKey,
      customerName,
      position: sheetIndex - 1,
      taxLabelPercent,
    });

    const lastRow = Number(sheet["!ref"]?.match(/\d+$/)?.[0] ?? 14);
    for (let sourceRow = 15; sourceRow <= lastRow; sourceRow += 1) {
      const invoiceNumber = asText(cellValue(sheet, `C${sourceRow}`));
      if (!invoiceNumber) continue;

      entries.push({
        sheetKey,
        sourceRow,
        receiptNumber: asText(cellValue(sheet, `B${sourceRow}`)),
        invoiceNumber,
        invoiceDate: asDate(cellValue(sheet, `D${sourceRow}`)),
        purchaseOrderNumber: asText(cellValue(sheet, `E${sourceRow}`)),
        deliveryDate: asDate(cellValue(sheet, `F${sourceRow}`)),
        description: asText(cellValue(sheet, `G${sourceRow}`)) ?? "",
        subtotal: asNumber(cellValue(sheet, `H${sourceRow}`)),
        taxAmount: asNumber(cellValue(sheet, `I${sourceRow}`)),
        grandTotal: asNumber(cellValue(sheet, `J${sourceRow}`)),
        transferDate: asDate(cellValue(sheet, `K${sourceRow}`)),
        taxInvoiceNumber: asText(cellValue(sheet, `L${sourceRow}`)),
        installment1: asNumber(cellValue(sheet, `Q${sourceRow}`)),
        installment2: asNumber(cellValue(sheet, `R${sourceRow}`)),
        installment3: asNumber(cellValue(sheet, `S${sourceRow}`)),
      });
    }
  }

  return { customers, entries };
}

export function calculatePaymentFakturAmounts(input: {
  grandTotal: number;
  transferDate?: Date | string | null;
  installment1?: number;
  installment2?: number;
  installment3?: number;
}) {
  const grandTotal = Math.max(0, asNumber(input.grandTotal));
  const installments = Math.max(
    0,
    asNumber(input.installment1) +
      asNumber(input.installment2) +
      asNumber(input.installment3),
  );
  const paidAmount = input.transferDate
    ? grandTotal
    : Math.min(grandTotal, installments);
  const remainingAmount = Math.max(0, grandTotal - paidAmount);
  const status: PaymentFakturStatus =
    remainingAmount === 0 && grandTotal > 0
      ? "LUNAS"
      : paidAmount > 0
        ? "CICILAN"
        : "BELUM_BAYAR";

  return { paidAmount, remainingAmount, status };
}
