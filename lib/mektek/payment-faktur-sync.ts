import { Prisma } from "@prisma/client";

import { normalizeFinanceKey } from "@/lib/mektek/finance";

type PaymentFakturTx = Prisma.TransactionClient;

/** Payment Faktur rows imported from the workbook start at row 15. */
const FIRST_GENERATED_SOURCE_ROW = 15;

/**
 * Finds the Payment Faktur customer sheet for a company, creating it when the
 * company is new — so a customer that first appears on a Logistics PO also
 * shows up across the Finance/Accounting ledgers.
 */
export async function ensurePaymentFakturCustomer(
  tx: PaymentFakturTx,
  customerName: string,
) {
  const name = String(customerName ?? "").replace(/\s+/g, " ").trim();
  if (!name) return null;

  const existing = await tx.paymentFakturCustomer.findFirst({
    where: { customerName: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing;

  const sheetKey = normalizeFinanceKey(name).slice(0, 120);
  if (!sheetKey) return null;

  const bySheetKey = await tx.paymentFakturCustomer.findUnique({
    where: { sheetKey },
    select: { id: true },
  });
  if (bySheetKey) return bySheetKey;

  const last = await tx.paymentFakturCustomer.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return tx.paymentFakturCustomer.create({
    data: {
      sheetKey,
      customerName: name,
      position: (last?.position ?? 0) + 1,
    },
    select: { id: true },
  });
}

export type PaymentFakturInvoiceSnapshot = {
  customerName: string;
  invoiceNumber: string;
  invoiceDate: Date | null;
  receiptNumber: string | null;
  purchaseOrderNumber: string | null;
  destinationBank: string | null;
  deliveryDate: Date | null;
  description: string;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  taxInvoiceNumber: string | null;
};

/**
 * Mirrors an issued invoice into the Payment Faktur ledger. Keyed on the
 * customer and invoice number so re-running it updates the existing row
 * instead of duplicating it, and so the installments already recorded against
 * a payment are never overwritten.
 */
export async function syncInvoiceToPaymentFaktur(
  tx: PaymentFakturTx,
  invoice: PaymentFakturInvoiceSnapshot,
  actorId?: string | null,
) {
  const invoiceNumber = String(invoice.invoiceNumber ?? "").trim();
  if (!invoiceNumber) return null;
  const customer = await ensurePaymentFakturCustomer(tx, invoice.customerName);
  if (!customer) return null;

  const data = {
    receiptNumber: invoice.receiptNumber,
    invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    purchaseOrderNumber: invoice.purchaseOrderNumber,
    destinationBank: invoice.destinationBank,
    deliveryDate: invoice.deliveryDate,
    description: invoice.description,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    grandTotal: invoice.subtotal.add(invoice.taxAmount),
    taxInvoiceNumber: invoice.taxInvoiceNumber,
  };

  const existing = await tx.paymentFakturEntry.findFirst({
    where: {
      customerId: customer.id,
      invoiceNumber: { equals: invoiceNumber, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) {
    return tx.paymentFakturEntry.update({
      where: { id: existing.id },
      data: { ...data, updatedBy: actorId ?? undefined },
      select: { id: true },
    });
  }

  const latest = await tx.paymentFakturEntry.findFirst({
    where: { customerId: customer.id, sourceRow: { not: null } },
    orderBy: { sourceRow: "desc" },
    select: { sourceRow: true },
  });
  return tx.paymentFakturEntry.create({
    data: {
      ...data,
      customerId: customer.id,
      sourceRow: Math.max(
        FIRST_GENERATED_SOURCE_ROW,
        (latest?.sourceRow ?? FIRST_GENERATED_SOURCE_ROW - 1) + 1,
      ),
      createdBy: actorId ?? undefined,
      updatedBy: actorId ?? undefined,
    },
    select: { id: true },
  });
}
