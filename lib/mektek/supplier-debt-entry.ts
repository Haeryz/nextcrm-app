import { Prisma } from "@prisma/client";

import snapshot from "@/lib/mektek/generated/supplier-debt-report-2026.snapshot.json";
import type { SupplierDebtWorkbookReport } from "@/lib/mektek/supplier-debt-report";

export type SupplierDebtEntryInput = {
  sheetKey: string;
  number?: string;
  purchaseOrderDate?: string;
  purchaseOrderNumber?: string;
  goodsReceiptDate?: string;
  receivedBy?: string;
  deliveryNoteNumber?: string;
  invoiceDate?: string;
  invoiceNumber?: string;
  taxInvoiceNumber?: string;
  dueDate?: string;
  partNumber?: string;
  description: string;
  quantity?: number | string;
  unitPrice?: number | string;
  amount?: number | string;
  ppnAmount?: number | string;
  grandTotal?: number | string;
  partsEntryDate?: string;
  paymentDate?: string;
  paymentAmount?: number | string;
  pbkDate?: string;
  accountCode?: string;
};

const report = snapshot.report as SupplierDebtWorkbookReport;
const validSheetKeys = new Set(report.detailSheets.map((sheet) => sheet.sheetKey));

const text = (value: unknown, max = 250) =>
  String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const dateOnly = (value: unknown) => {
  const raw = text(value, 10);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const decimal = (value: unknown, scale = 2) => {
  const normalized = String(value ?? "").replace(/[^\d.-]/g, "");
  const parsed = normalized ? Number(normalized) : 0;
  return Number.isFinite(parsed) && parsed >= 0
    ? new Prisma.Decimal(parsed.toFixed(scale))
    : null;
};

export function parseSupplierDebtEntryInput(input: SupplierDebtEntryInput) {
  const sheetKey = text(input.sheetKey, 120);
  const description = text(input.description, 2000);
  const purchaseOrderNumber = text(input.purchaseOrderNumber, 200);
  const deliveryNoteNumber = text(input.deliveryNoteNumber, 200);
  const invoiceNumber = text(input.invoiceNumber, 200);
  const quantity = decimal(input.quantity, 3);
  const unitPrice = decimal(input.unitPrice);
  const requestedAmount = decimal(input.amount);
  const ppnAmount = decimal(input.ppnAmount) ?? new Prisma.Decimal(0);
  const requestedGrandTotal = decimal(input.grandTotal);
  const paymentAmount = decimal(input.paymentAmount);
  const dates = {
    purchaseOrderDate: dateOnly(input.purchaseOrderDate),
    goodsReceiptDate: dateOnly(input.goodsReceiptDate),
    invoiceDate: dateOnly(input.invoiceDate),
    dueDate: dateOnly(input.dueDate),
    partsEntryDate: dateOnly(input.partsEntryDate),
    paymentDate: dateOnly(input.paymentDate),
    pbkDate: dateOnly(input.pbkDate),
  };

  if (!validSheetKeys.has(sheetKey)) {
    return { error: "Sheet pemasok tidak valid" } as const;
  }
  if (!purchaseOrderNumber && !deliveryNoteNumber && !invoiceNumber) {
    return { error: "Isi minimal Nomor PO, Nomor SJ, atau Nomor invoice" } as const;
  }
  if (!description) return { error: "Deskripsi wajib diisi" } as const;
  if (
    !quantity ||
    !unitPrice ||
    !requestedAmount ||
    !requestedGrandTotal ||
    !paymentAmount
  ) {
    return { error: "Nilai jumlah atau nominal tidak valid" } as const;
  }
  if (Object.values(dates).some((value) => value === undefined)) {
    return { error: "Format tanggal tidak valid" } as const;
  }

  const calculatedAmount = quantity.mul(unitPrice);
  const amount = requestedAmount.gt(0) ? requestedAmount : calculatedAmount;
  const grandTotal = requestedGrandTotal.gt(0)
    ? requestedGrandTotal
    : amount.add(ppnAmount);
  if (grandTotal.lte(0)) {
    return { error: "Grand total harus lebih dari 0" } as const;
  }
  if (paymentAmount.gt(grandTotal)) {
    return { error: "Nominal bayar tidak boleh melebihi grand total" } as const;
  }

  return {
    data: {
      sheetKey,
      number: text(input.number, 40) || null,
      ...dates,
      purchaseOrderNumber: purchaseOrderNumber || null,
      receivedBy: text(input.receivedBy, 160) || null,
      deliveryNoteNumber: deliveryNoteNumber || null,
      invoiceNumber: invoiceNumber || null,
      taxInvoiceNumber: text(input.taxInvoiceNumber, 200) || null,
      partNumber: text(input.partNumber, 200) || null,
      description,
      quantity,
      unitPrice,
      amount,
      ppnAmount,
      grandTotal,
      paymentAmount,
      accountCode: text(input.accountCode, 160) || null,
    },
  } as const;
}
