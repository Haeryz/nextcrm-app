import {
  buildFinanceRevenueSplit,
  type FinanceRevenueCategory,
} from "@/lib/mektek/finance";

export type FinanceRecapInvoice = {
  id: string;
  invoiceNumber: string | null;
  draftNumber: string;
  status: string;
  customer: string;
  invoiceDate: string | null;
  deliveryNoteNumber: string | null;
  deliveryNoteDate: string | null;
  receiptNumber: string | null;
  purchaseOrderNumber: string | null;
  purchaseOrderDate: string | null;
  taxInvoiceNumber: string | null;
  subtotal: number;
  taxAmount: number;
  netAmount: number;
  paidAmount: number;
  lines: Array<{
    kind: string;
    description: string;
    lineTotal: number;
  }>;
  deliveryNotes: Array<{
    id: string;
    number: string;
    date: string | null;
    description: string;
    subtotal: number | null;
  }>;
};

export type FinanceSynchronizedRevenueRow = {
  key: string;
  /** The invoice this recap row derives from, used to edit or remove it. */
  invoiceId: string;
  category: Exclude<FinanceRevenueCategory, "unclassified">;
  customer: string;
  deliveryNoteNumber: string;
  deliveryNoteDate: string | null;
  receiptNumber: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  purchaseOrderNumber: string;
  purchaseOrderDate: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  taxInvoiceNumber: string;
  description: string;
};

const monthKeys = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

const displayInvoiceNumber = (invoice: FinanceRecapInvoice) =>
  invoice.invoiceNumber || `Draf ${invoice.draftNumber.slice(0, 8)}`;

const invoiceMonth = (value: string | null) => {
  if (!value) return null;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12 ? monthKeys[month - 1] : null;
};

export function buildFinanceSynchronizedRecaps(
  invoices: FinanceRecapInvoice[],
) {
  const activeInvoices = invoices.filter((invoice) => invoice.status !== "VOID");
  const deliveryNotes: Array<{
    id: string;
    /** The invoice this recap row derives from, used to edit or remove it. */
    invoiceId: string;
    company: string;
    deliveryNoteNumber: string;
    deliveryNoteDate: string | null;
    invoiceNumber: string;
    invoiceDate: string | null;
    purchaseOrderNumber: string;
    purchaseOrderDate: string | null;
    description: string;
    subtotal: number;
    taxAmount: number;
    total: number;
  }> = [];
  const receivables = new Map<
    string,
    {
      id: string;
      number: string;
      customer: string;
      totalReceivable: number;
      paid: number;
      balance: number;
      monthly: Record<(typeof monthKeys)[number], number>;
      monthlyPaid: Record<(typeof monthKeys)[number], number>;
      monthlyBalance: Record<(typeof monthKeys)[number], number>;
      notes: string;
    }
  >();
  const revenueRows: FinanceSynchronizedRevenueRow[] = [];
  const unclassifiedInvoices: Array<{
    id: string;
    invoiceNumber: string;
    customer: string;
    descriptions: string[];
  }> = [];
  let unclassifiedCount = 0;
  let unclassifiedSubtotal = 0;

  for (const invoice of activeInvoices) {
    const invoiceNumber = displayInvoiceNumber(invoice);
    const descriptions = invoice.lines
      .map((line) => line.description.trim())
      .filter(Boolean);
    const linkedDeliveryNotes = invoice.deliveryNotes.length
      ? invoice.deliveryNotes
      : invoice.deliveryNoteNumber
        ? [
            {
              id: `${invoice.id}:manual-delivery-note`,
              number: invoice.deliveryNoteNumber,
              date: invoice.deliveryNoteDate,
              description: descriptions.join("; "),
              subtotal: invoice.subtotal,
            },
          ]
        : [];
    const sourceSubtotalTotal = linkedDeliveryNotes.reduce(
      (total, deliveryNote) => total + Math.max(deliveryNote.subtotal ?? 0, 0),
      0,
    );
    for (const deliveryNote of linkedDeliveryNotes) {
      const subtotal =
        deliveryNote.subtotal ??
        (linkedDeliveryNotes.length
          ? invoice.subtotal / linkedDeliveryNotes.length
          : invoice.subtotal);
      const taxShare =
        sourceSubtotalTotal > 0
          ? Math.max(deliveryNote.subtotal ?? 0, 0) / sourceSubtotalTotal
          : 1 / linkedDeliveryNotes.length;
      const taxAmount = Math.round(invoice.taxAmount * taxShare * 100) / 100;
      deliveryNotes.push({
        id: `${invoice.id}:${deliveryNote.id}`,
        invoiceId: invoice.id,
        company: invoice.customer,
        deliveryNoteNumber: deliveryNote.number,
        deliveryNoteDate: deliveryNote.date,
        invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        purchaseOrderNumber: invoice.purchaseOrderNumber ?? "",
        purchaseOrderDate: invoice.purchaseOrderDate,
        description: deliveryNote.description || descriptions.join("; "),
        subtotal,
        taxAmount,
        total: subtotal + taxAmount,
      });
    }

    const receivable = receivables.get(invoice.customer) ?? {
      id: `customer:${invoice.customer}`,
      number: "",
      customer: invoice.customer,
      totalReceivable: 0,
      paid: 0,
      balance: 0,
      monthly: Object.fromEntries(
        monthKeys.map((month) => [month, 0]),
      ) as Record<(typeof monthKeys)[number], number>,
      monthlyPaid: Object.fromEntries(
        monthKeys.map((month) => [month, 0]),
      ) as Record<(typeof monthKeys)[number], number>,
      monthlyBalance: Object.fromEntries(
        monthKeys.map((month) => [month, 0]),
      ) as Record<(typeof monthKeys)[number], number>,
      notes: "",
    };
    receivable.totalReceivable += invoice.netAmount;
    const paidAmount = Math.min(invoice.paidAmount, invoice.netAmount);
    receivable.paid += paidAmount;
    const month = invoiceMonth(invoice.invoiceDate);
    if (month) {
      receivable.monthly[month] += invoice.netAmount;
      receivable.monthlyPaid[month] += paidAmount;
      receivable.monthlyBalance[month] += Math.max(
        invoice.netAmount - paidAmount,
        0,
      );
    }
    receivables.set(invoice.customer, receivable);

    const split = buildFinanceRevenueSplit({
      taxAmount: invoice.taxAmount,
      lines: invoice.lines,
    });
    if (split.unclassified.subtotal > 0) {
      unclassifiedCount += 1;
      unclassifiedSubtotal += split.unclassified.subtotal;
      unclassifiedInvoices.push({
        id: invoice.id,
        invoiceNumber,
        customer: invoice.customer,
        descriptions: split.unclassified.descriptions,
      });
    }
    for (const category of ["sparepart", "service"] as const) {
      const bucket = split[category];
      if (bucket.subtotal <= 0) continue;
      revenueRows.push({
        key: `${invoice.id}:${category}`,
        invoiceId: invoice.id,
        category,
        customer: invoice.customer,
        deliveryNoteNumber: invoice.deliveryNoteNumber ?? "",
        deliveryNoteDate: invoice.deliveryNoteDate,
        receiptNumber: invoice.receiptNumber ?? "",
        invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        purchaseOrderNumber: invoice.purchaseOrderNumber ?? "",
        purchaseOrderDate: invoice.purchaseOrderDate,
        subtotal: bucket.subtotal,
        taxAmount: bucket.taxAmount,
        total: bucket.total,
        taxInvoiceNumber: invoice.taxInvoiceNumber ?? "",
        description: bucket.descriptions.join("; "),
      });
    }
  }

  const receivableRows = [...receivables.values()]
    .sort((left, right) => left.customer.localeCompare(right.customer, "id"))
    .map((row, index) => {
      const balance = Math.max(row.totalReceivable - row.paid, 0);
      return {
        ...row,
        number: String(index + 1),
        balance,
        notes:
          row.totalReceivable === 0
            ? ""
            : balance === 0
              ? "LUNAS"
              : "BELUM LUNAS",
      };
    });

  return {
    deliveryNotes,
    receivables: receivableRows,
    revenueRows,
    unclassifiedCount,
    unclassifiedSubtotal,
    unclassifiedInvoices,
  };
}
