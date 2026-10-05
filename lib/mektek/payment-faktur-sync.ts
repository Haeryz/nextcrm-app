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

/** What the invoice looked like before an edit, so its old mirror can be found. */
export type PaymentFakturPreviousInvoice = {
  invoiceNumber: string | null;
  customerNormalizedName: string;
};

/**
 * Mirrors an issued invoice into the Payment Faktur ledger. Keyed on the
 * customer and invoice number so re-running it updates the existing row
 * instead of duplicating it, and so the installments already recorded against
 * a payment are never overwritten.
 *
 * When an edit changes the customer or the invoice number, the row mirrored
 * under the old key is moved instead of left behind; a stale copy would keep
 * counting toward the old customer's total.
 */
export async function syncInvoiceToPaymentFaktur(
  tx: PaymentFakturTx,
  invoice: PaymentFakturInvoiceSnapshot,
  actorId?: string | null,
  previous?: PaymentFakturPreviousInvoice,
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

  let existing = await tx.paymentFakturEntry.findFirst({
    where: {
      customerId: customer.id,
      invoiceNumber: { equals: invoiceNumber, mode: "insensitive" },
    },
    select: { id: true },
  });
  const stale = previous
    ? await findPreviousMirrors(tx, previous, existing?.id ?? null)
    : [];
  if (!existing && stale.length) {
    // Carry the old row (and any installments on it) over to the new key.
    const moved = stale.shift() ?? null;
    existing = moved;
    if (moved && moved.customerId !== customer.id) {
      await tx.paymentFakturEntry.update({
        where: { id: moved.id },
        data: {
          customerId: customer.id,
          sourceRow: await nextSourceRow(tx, customer.id),
        },
      });
    }
  }
  const unpaidStaleIds = stale.filter((row) => !row.hasPayment).map((row) => row.id);
  if (unpaidStaleIds.length) {
    await tx.paymentFakturEntry.deleteMany({ where: { id: { in: unpaidStaleIds } } });
  }
  if (existing) {
    return tx.paymentFakturEntry.update({
      where: { id: existing.id },
      data: { ...data, updatedBy: actorId ?? undefined },
      select: { id: true },
    });
  }

  return tx.paymentFakturEntry.create({
    data: {
      ...data,
      customerId: customer.id,
      sourceRow: await nextSourceRow(tx, customer.id),
      createdBy: actorId ?? undefined,
      updatedBy: actorId ?? undefined,
    },
    select: { id: true },
  });
}

/**
 * Drops a deleted invoice's Payment Faktur mirror so it stops counting toward
 * the customer's total. A row that already has a payment recorded is kept.
 */
export async function removeInvoiceFromPaymentFaktur(
  tx: PaymentFakturTx,
  invoice: PaymentFakturPreviousInvoice,
) {
  const unpaidIds = (await findPreviousMirrors(tx, invoice, null))
    .filter((row) => !row.hasPayment)
    .map((row) => row.id);
  if (unpaidIds.length) {
    await tx.paymentFakturEntry.deleteMany({ where: { id: { in: unpaidIds } } });
  }
}

async function findPreviousMirrors(
  tx: PaymentFakturTx,
  previous: PaymentFakturPreviousInvoice,
  keepId: string | null,
) {
  const previousNumber = String(previous.invoiceNumber ?? "").trim();
  if (!previousNumber || !previous.customerNormalizedName) return [];
  const rows = await tx.paymentFakturEntry.findMany({
    where: {
      invoiceNumber: { equals: previousNumber, mode: "insensitive" },
      ...(keepId ? { id: { not: keepId } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      customerId: true,
      transferDate: true,
      installment1: true,
      installment2: true,
      installment3: true,
      customer: { select: { customerName: true } },
    },
  });
  return rows
    .filter(
      (row) =>
        normalizeFinanceKey(row.customer.customerName) ===
        previous.customerNormalizedName,
    )
    .map((row) => ({
      id: row.id,
      customerId: row.customerId,
      hasPayment:
        Boolean(row.transferDate) ||
        row.installment1.add(row.installment2).add(row.installment3).gt(0),
    }));
}

async function nextSourceRow(tx: PaymentFakturTx, customerId: string) {
  const latest = await tx.paymentFakturEntry.findFirst({
    where: { customerId, sourceRow: { not: null } },
    orderBy: { sourceRow: "desc" },
    select: { sourceRow: true },
  });
  return Math.max(
    FIRST_GENERATED_SOURCE_ROW,
    (latest?.sourceRow ?? FIRST_GENERATED_SOURCE_ROW - 1) + 1,
  );
}
